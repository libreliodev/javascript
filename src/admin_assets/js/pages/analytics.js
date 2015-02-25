
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
					dimensions: 'ga:eventLabel',
					filters: 'ga:eventAction=@Succeeded'
				  }
				});
				report.on('success', function(response) {
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
				  				obj.folderName= d.folderName;
				  				obj.qty = +d[1];
								if (d.fileName.lastIndexOf('_') == d.fileName.length - 1) obj.type='paid';//Paid publications have a file name ending with _
								else obj.type='free';
				  				publications.push(obj);
				  			}

				  		}
				  	});
				  	
				  	
	
				  	console.log(publications);
				  	$("#pivotstable").pivotUI(publications);


				  	

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
