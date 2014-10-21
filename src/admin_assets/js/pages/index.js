$(function()
{
  var app_name = storage.getItem(config.storageAppNameKey),
  app_dir = get_app_dir(app_name);
  if(!app_name)
    return;
  awsCredentialsReady(function()
    {
      $('#publisher-name2').text(s3AuthObj.rootDirectory);

    });
});
