$(function(){
  
  var app_name = storage.getItem(config.storageAppNameKey),
  app_dir = get_app_dir(app_name);

  awsS3Ready(start);

  function start()
  {
    awsS3.getSignedUrl('getObject', {
      Bucket: config.s3Bucket,
      Key: app_dir + '/APP_/REPORTS/publications_.csv',
      Expires: awsExpireReverse(config.awsExpireReverseInHours)
    }, function(err, table_url)
       {
         if(err)
           return notifyUserError(err);
         var tableReader = new TableReader({
           element: document.getElementById('pivotstable')
         });
         tableReader.load(table_url, function(err)
           {
             
           });
       });
  }

});
