var s3AuthObj,
awsS3;
if(!supports_html5_storage())
    alert("This app does not support your browser");
else
{
    s3AuthObj = JSON.parse(localStorage.getItem(config.localStorageAuthKey));
    if(!s3AuthObj)
    {
        $('body > *').hide();
        document.location = "login.html";
    }
    else
    {
        AWS.config.update({
            accessKeyId: s3AuthObj.accessKeyId,
            secretAccessKey: s3AuthObj.secretAccessKey
        });
        AWS.config.region = config.s3BucketRegion;
        awsS3 = new AWS.S3({ region: config.s3BucketRegion });
    }
}
