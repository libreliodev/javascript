
var app_name = storage.getItem(config.storageAppNameKey),
app_dir = get_app_dir(app_name);

(function(w,d,s,g,js,fjs){
  g=w.gapi||(w.gapi={});g.analytics={q:[],ready:function(cb){this.q.push(cb)}};
  js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
  js.src='https://apis.google.com/js/platform.js';
  fjs.parentNode.insertBefore(js,fjs);js.onload=function(){g.load('analytics')};
}(window,document,'script'));

gapi.analytics.ready(function()
{

/**
 * A DateRangeSelector component for the Embed API, provided by Google.
 */
gapi.analytics.ready(function() {

  var nDaysAgo = /(\d+)daysAgo/;
  var dateFormat = /\d{4}\-\d{2}\-\d{2}/;

  /**
   * Convert a date acceptable to the Core Reporting API (e.g. `today`,
   * `yesterday` or `NdaysAgo`) into the format YYYY-MM-DD. Dates
   * already in that format are simply returned.
   * @return {string} The formatted date.
   */
  function convertDate(str) {
    // If str is in the proper format, do nothing.
    if (dateFormat.test(str)) return str;

    var match = nDaysAgo.exec(str);
    if (match) {
      return daysAgo(+match[1]);
    } else if (str == 'today') {
      return daysAgo(0);
    } else if (str == 'yesterday') {
      return daysAgo(1);
    } else {
      throw new Error('Cannot convert date ' + str);
    }
  }

  /**
   * Accept a number and return a date formatted as YYYY-MM-DD that
   * represents that many days ago.
   * @return {string} The formatted date.
   */
  function daysAgo(numDays) {
    var date = new Date();
    date.setDate(date.getDate() - numDays);
    var month = String(date.getMonth() + 1);
    month = month.length == 1 ? '0' + month: month;
    var day = String(date.getDate());
    day = day.length == 1 ? '0' + day: day;
    return date.getFullYear() + '-' + month + '-' + day;
  }

  gapi.analytics.createComponent('DateRangeSelector', {

		/**
		 * Initialize the DateRangeSelector instance and render it to the page.
		 * @return {DateRangeSelector} The instance.
		 */
		execute: function() {
		  var options = this.get();
		  options['start-date'] = options['start-date'] || '7daysAgo';
		  options['end-date'] = options['end-date'] || 'yesterday';

		  // Allow container to be a string ID or an HTMLElement.
		  this.container = typeof options.container == 'string' ?
			document.getElementById(options.container) : options.container;

		  // Allow the template to be overridden.
		  if (options.template) this.template = options.template;

		  this.container.innerHTML = this.template;
		  var dateInputs = this.container.querySelectorAll('input');

		  this.startDateInput = dateInputs[0];
		  this.startDateInput.value = convertDate(options['start-date']);
		  this.endDateInput = dateInputs[1];
		  this.endDateInput.value = convertDate(options['end-date']);

		  this.setValues();
		  this.setMinMax();

		  this.container.onchange = this.onChange.bind(this);
		  return this;
		},

		/**
		 * Emit a change event based on the currently selected dates.
		 * Pass an object containing the start date and end date.
		 */
		onChange: function() {
		  this.setValues();
		  this.setMinMax();
		  this.emit('change', {
			'start-date': this['start-date'],
			'end-date': this['end-date']
		  });
		},

		/**
		 * Updates the instance properties based on the input values.
		 */
		setValues: function() {
		  this['start-date'] = this.startDateInput.value;
		  this['end-date'] = this.endDateInput.value;
		},

		/**
		 * Updates the input min and max attributes so there's no overlap.
		 */
		setMinMax: function() {
		  this.startDateInput.max = this.endDateInput.value;
		  this.endDateInput.min = this.startDateInput.value;
		},

		/**
		 * The html structure used to build the component. Developers can
		 * override this by passing it to the component constructor.
		 * The only requirement is that the structure contain two inputs, the
		 * first will be the start date and the second will be the end date.
		 */
		template:
		  '<div class="row">'+
		  '<form class="form-horizontal">'+
		  '<div class="DateRangeSelector form-group">' +
		  '    <label class="control-label col-lg-2" localize>Start Date</label> ' +
		  '<div class="col-lg-2">'+
		  '    <input type="date" class="form-control">' +
		  '</div>'+
		  '    <label class="control-label col-lg-2" localize>End Date</label> ' +
		  '<div class="col-lg-2">'+
		  '    <input type="date" class="form-control">' +
		  '</div>'+
		  '</div>'+
		  '</form>'+
		  '</div>'
	  });

	});


  awsS3Ready(function()
    {
      awsS3.getObject({
        Bucket: config.s3Bucket,
        Key: app_dir + '/APP_/Uploads/setup.plist',
      }, function(err, res)
         {
           if(err && err.code != 'NoSuchKey')
           {
             handleAWSS3Error(err);
             failure();
             return;
           }
           if(err)
           {
             notifyUserError("You should setup app first! <a href=\"setup.html\">Click Here!</a>");
             failure();
             return;
           }
           var setup_obj = res ? $.plist($.parseXML(res.Body.toString())) : {},
           ga_webPropertyId = setup_obj.GACode,
           ga_profile;
           /**
            * Authorize the user immediately if the user has already granted access.
            * If no access has been created, render an authorize button inside the
            * element with the ID "embed-api-auth-container".
            */
           var authRequest = gapi.analytics.auth.authorize({
             container: 'auth-button-wrp',
             clientid: config.GoogleClientId
           });
           authRequest.on('success', fetchAccount);
           
           function fetchAccount()
           {
             $('#auth-button-wrp').hide();
             var request = gapi.client.analytics.management.accounts.list();
             request.execute(responseCompleteProcessGetItems(
                                                fetchAccountComplete));
           }

           function fetchAccountComplete(items)
           {
             if(!ga_webPropertyId)
             {
               ga_webPropertyId = prompt("Please enter GACode");
               if(!ga_webPropertyId)
                 return;
             }
             var requests = [];
             for(var i = 0; i < items.length; ++i)
               requests.push(getFetchProfileHanlder(items[i]));
             function getFetchProfileHanlder(item)
             {
               return function(next)
               {
                 var request = gapi.client.analytics.management.profiles.list({
                   accountId: item.id,
                   webPropertyId: ga_webPropertyId
                 });
                 request.execute(responseCompleteProcessForSingleResult
                                        (responseHandler, false));
                 function responseHandler(item)
                 {
                   next(item);
                 }
               }
             }
             
             async.parallel(requests, function(item)
               {
                 if(!item)
                 {
                   notifyUserError("Profile not found!");
                   failure();
                 }
                 else
                   fetchProfileComplete(item);
               });
           }

           function fetchProfileComplete(item)
           {
             ga_profile = item;
             $('#page-loading-indicator').hide();
             setup_ga_data();
           }
           function setup_ga_data()
           {
											 // Load the Visualization API and the piechart package.
								  google.load('visualization', '1.0', {'packages':['corechart']});

								  // Set a callback to run when the Google Visualization API is loaded.
								  google.setOnLoadCallback(drawChart);

								  // Callback that creates and populates a data table,
								  // instantiates the pie chart, passes in the data and
								  // draws it.
								  function drawChart() {

									// Create the data table.
									var data = new google.visualization.DataTable();
									data.addColumn('string', 'Topping');
									data.addColumn('number', 'Slices');
									data.addRows([
									  ['Mushrooms', 3],
									  ['Onions', 1],
									  ['Olives', 1],
									  ['Zucchini', 1],
									  ['Pepperoni', 2]
									]);

									// Set chart options
									var options = {'title':'How Much Pizza I Ate Last Night',
												   'width':400,
												   'height':300};

									// Instantiate and draw our chart, passing in some options.
									var chart = new google.visualization.PieChart(document.getElementById('chart_div'));
									chart.draw(data, options);
								  }

           	 var dateRange1 = {
				'start-date': '5daysAgo',
				'end-date': 'yesterday'
			  };
			  var dateRangeSelector1 = new gapi.analytics.ext.DateRangeSelector({
				container: 'date-range-selector-1-container'
			  })
			  .set(dateRange1)
			  .execute();
			  

             var countryDataChart = new gapi.analytics.googleCharts.DataChart({
               query: {
                 ids: 'ga:' + ga_profile.id,
                 metrics: 'ga:sessions',
                 dimensions: 'ga:country',
               },
               chart: {
                 container: 'country-chart',
                 type: 'GEO',
                 options: {
                   width: '100%'
                 }
               }
             });
            countryDataChart.set({query: dateRange1});

             countryDataChart.execute();

             var deviceDataChart = new gapi.analytics.googleCharts.DataChart({
               query: {
                 ids: 'ga:' + ga_profile.id,
                 metrics: 'ga:sessions',
                 dimensions: 'ga:mobileDeviceModel',
                 sort: '-ga:sessions',
                 'max-results': 10
               },
               chart: {
                 container: 'device-chart',
                 type: 'PIE',
                 options: {
                   width: '100%'
                 }
               }
             });
             deviceDataChart.execute(); 
             
             var report = new gapi.analytics.report.Data({
				  query: {
					ids: 'ga:' + ga_profile.id,
					metrics: 'ga:totalEvents',
					dimensions: 'ga:eventLabel',
					filters: 'ga:eventAction=@Succeeded'
				  }
				});
				report.on('success', function(response) {

				  
				  //var data = [4, 8, 15, 16, 23, 42];
				  var data = response.rows;
				  	data.forEach(function(d, i) { 
				  		d.filePath=d[0].match(/\/\/?(.[^\?]+)(.*)/)[1]; 
				  		parts  = (d.filePath).match(/(.*)\/(.*)\.(.*)/);
				  		if (parts){
				  			d.folderName = parts[1];
				  			d.fileName = parts[2];
				  			d.fileExtension = parts[3];

				  		}
				  	});
				  	
				  	var publications = data.filter(function(d) { 
				  		return (d.fileName&&((d.folderName == d.fileName)|| (d.folderName+'_' == d.fileName)));
				  	});//Publications are inside directories having the same name as the file
				  	
				  	var paidPublications = publications.filter(function(d) { 
				  		if (!d.fileName) return false;
				  		return ((d.fileName.indexOf('_.') > -1));
				  	});//Paid publications have a file name ending with _
				  	
				  	var freePublications = publications.filter(function(d) { 
				  		if (!d.fileName) return false;
				  		return ((d.fileName.indexOf('_.') == -1));
				  	});
				  	
				  	paidPublications.forEach(function(d, i) { 
				  		d.paidQuantity=d[1]; 
				  	});

				  	freePublications.forEach(function(d, i) { 
				  		d.freeQuantity=d[1]; 
				  	});
				  	
				  	var allPublications = d3.merge([paidPublications,freePublications]);
				  	var paidAndFreePublications = d3.nest()
						.key(function(d) { return d.folderName; })
						.rollup(function(leaves) { return {"paidQuantity": d3.sum(leaves, function(d) {return d.paidQuantity;}), "freeQuantity": d3.sum(leaves, function(d) {return d.freeQuantity;})} })
						.entries(allPublications);

				  	
				  	
				  	console.log(paidAndFreePublications);
					var x = d3.scale.linear()
						.domain([0, d3.max(data, function(d) { return +d[1]; })])
						.range([0, 420]);

					d3.select(".chart")
					  .selectAll("div")
						.data(paidAndFreePublications)
					  .enter().append("div")
						.style("width", function(d) { return x(d[1]) + "px"; })
						.text(function(d) { 
							return d.key+':'+d.values.freeQuantity+','+d.values.paidQuantity; 
						});

				});

				report.execute();            
           }
         });
    });
});


function failure()
{ 
  $('#page-loading-indicator').hide();
}


function responseCompleteProcessForSingleResult(cb, notfounderror)
{
  return function(results)
  {
    if(results && !results.error && results.items &&
       results.items.length > 0)
    {
      cb(results.items[0]);
    }
    else
    {
      if(notfounderror === false)
        return cb();
      if(!results && !results.error)
      {
        notifyUserError(notfounderror);
      }
      else
      {
        notifyUserError(results.error.message);
      }
      failure();
    }
  };
}

function responseCompleteProcessGetItems(cb, noerror)
{
  return function(results)
  {
    if(results && !results.error && results.items)
    {
      cb(results.items);
    }
    else
    {
      if(noerror)
        return cb([]);
      if(!results && !results.error)
      {
        notifyUserError("Unexpected error!");
      }
      else
      {
        notifyUserError(results.error.message);
      }
      failure();
    }
  };
}

;
