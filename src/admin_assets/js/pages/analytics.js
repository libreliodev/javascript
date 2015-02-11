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
             var countryDataChart = new gapi.analytics.googleCharts.DataChart({
               query: {
                 ids: 'ga:' + ga_profile.id,
                 metrics: 'ga:sessions',
                 dimensions: 'ga:country',
                 //'start-date': '30daysAgo',
                 //'end-date': 'yesterday'
               },
               chart: {
                 container: 'country-chart',
                 type: 'GEO',
                 options: {
                   width: '100%'
                 }
               }
             });
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
