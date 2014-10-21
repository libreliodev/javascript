$(function()
{
  var app_name = storage.getItem(config.storageAppNameKey),
  app_dir = get_app_dir(app_name);
  if(!app_name)
    return;
  awsS3Ready(function()
    {
      $('#publisher-name2').text(s3AuthObj.rootDirectory);

      s3ObjectExists(awsS3, {
        Bucket: config.s3Bucket,
        Key: app_dir + '/APP_/Uploads/setup.plist',
      }, function(err, exist)
         {
           if(err)
             return handleAWSS3Error(err);

           if(!exist)
             return notifyUserError("You should setup app first! <a href=\"setup.html\">Click Here!</a>");
           var reader = $('<iframe/>');
           reader.prop('id', 'reader');
           reader.attr('src', 'http://reader.librelio.com?' + 
                                             querystring.stringify({
                                               wapublisher: 
                                                     s3AuthObj.rootDirectory,
                                               waapp: app_name, 
                                               waversion: 'html5'
                                             }));
           $('#reader-wrapper').append(reader);
         });
    });
});
