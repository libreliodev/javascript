function handleAWSS3Error(err)
{
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
