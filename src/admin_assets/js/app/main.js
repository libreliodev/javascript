function handleAWSS3Error(err)
{
    if(err.code == 'NotImplemented')
        alert(err + ', This feature is available in  IE, Firefox or Chrome.');
    else
        alert(err);
    if(err.code == 'InvalidAccessKeyId')
    {
        userLogout();
        document.location = 'login.html';
    }
}

function userLogout()
{
    if(storage)
        storage.setItem(config.storageAuthKey, '');
}

function notifyUserError(err)
{
    bootbox.alert(err);
}

function get_publisher_dir()
{
  return s3AuthObj.rootDirectory;
}

function get_app_dir(app_name)
{
    return get_publisher_dir() + '/' + app_name; /*+ 
        (s3AuthObj.type == 'idFed' ? '/' + s3AuthObj.userDirname : '');*/
}

function awsS3Ready(cb)
{
    if(awsS3)
        cb();
    else
        $(document).bind('awsS3Initialized', cb);
}

function awsCredentialsReady(cb)
{
    if(AWS.config.credentials)
        cb();
    else
        $(document).bind('awsCredentialsReady', cb);
}
