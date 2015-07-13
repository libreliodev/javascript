
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
			
				
           	 var dateRange1 = {
				'start-date': '5daysAgo',
				'end-date': 'yesterday'
			  };
			  

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
					'start-date':'2005-01-01',
					dimensions: 'ga:eventLabel,ga:yearMonth,ga:operatingSystem',
					filters: 'ga:eventAction=@Succeeded',
					'max-results':10000
				  }
				});
				report.on('success', function(response) {
					//console.log(response);
				  var data = response.rows;
				  var publications = [];
				  	data.forEach(function(d, i) { 
				  		d.filePath=d[0].match(/\/\/?(.[^\?]+)(.*)/)[1]; 
				  		parts  = (d.filePath).match(/(.*)\/(.*)\.(.*)/);
				  		if (parts){
							d.folderName = parts[1];
							d.fileName = parts[2];
							d.fileExtension = parts[3];
				  			//Publications are inside directories having the same name as the file
				  			if (d.fileName&&((d.folderName == d.fileName)|| (d.folderName+'_' == d.fileName))){
				  				var obj = {};
				  				obj.Publication= d.folderName;
				  				obj.YearMonth = d[1]
				  				obj.OS = d[2]
				  				obj.Qty = +d[3];
								if (d.fileName.lastIndexOf('_') == d.fileName.length - 1) obj.Type='Paid';//Paid publications have a file name ending with _
								else obj.Type='Free';
				  				publications.push(obj);
				  			}

				  		}
				  	});
				  	
				  	
	
				  	//console.log(publications);
				  	
					var sum = $.pivotUtilities.aggregatorTemplates.sum;
					var numberFormat = $.pivotUtilities.numberFormat;
					var intFormat = numberFormat({digitsAfterDecimal: 0}); 

				  	$("#pivotstable").pivotUI(
				  		publications,   
				  		{
							rows: ["Publication"],
							cols: ["Type"],
							aggregators: {"Quantity":function() { return sum(intFormat)(["Qty"]) }},
							hiddenAttributes: ["Qty"]
						}

				  		
				  	);


				  	

				});


				report.execute();      
                   
                   var report2 = new gapi.analytics.report.Data({
				  query: {
					ids: 'ga:' + ga_profile.id,
					metrics: 'ga:uniqueScreenviews',
					'start-date':'2005-01-01',
					dimensions: 'ga:screenName,ga:yearMonth',
					filters: 'ga:screenName=@PDFReader/',
					'max-results':10000

				  }
				});
				report2.on('success', function(response) {
				 console.log(response);
				  var data = response.rows;
				  var publications2 = [];
				  	data.forEach(function(d, i) { 
				  		//console.log(d[0]);
				  		parts  = d[0].match(/(.*?)\/(.*?)\/page(.*?)/);
				  		if (parts){
							d.fileName = parts[2];
							d.page = parts[3];
				  				var obj = {};
				  				obj.Publication= parts[2];
				  				obj.YearMonth = d[1]
				  				obj.Qty = +d[2];
				  				obj.Type='Free';
				  				obj.Page= parts[3];
								if (d.fileName.lastIndexOf('_') == d.fileName.length - 1) {
									obj.Type='Paid';//Paid publications have a file name ending with _
									obj.Publication = d.fileName.substring(0, d.fileName.length - 1);//Remove final _
								}
				  				publications2.push(obj);

				  		}
				  	});
				  	
				  	
	
				  	//console.log(publications2);
				  	
					var sum = $.pivotUtilities.aggregatorTemplates.sum;
					var numberFormat = $.pivotUtilities.numberFormat;
					var intFormat = numberFormat({digitsAfterDecimal: 0}); 

				  	$("#pivotstable2").pivotUI(
				  		publications2,   
				  		{
							rows: ["Publication"],
							cols: ["Type"],
							aggregators: {"Quantity":function() { return sum(intFormat)(["Qty"]) }},
							hiddenAttributes: ["Qty"]
						}

				  		
				  	);


				  	

				});


				report2.execute();      
      
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
