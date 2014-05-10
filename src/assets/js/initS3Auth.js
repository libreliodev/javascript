var s3AuthObj,
awsS3;
if(!storage)
    alert("This app does not support your browser");
else
{
    storage.type = 'local';
    storage.type = storage.getItem('storage-type') || 'session';
    try {
        s3AuthObj = JSON.parse(storage.getItem(config.storageAuthKey));
    }catch(e) {
        s3AuthObj = null;
    }
    if(!s3AuthObj)
    {
        $('body > *').hide();
        var query,
        path_fn = path.urlFilename(document.location);
        if(path_fn != 'index.html' && path_fn !== '')
            query = '?redirect=' + encodeURIComponent(path_fn);
        document.location = "login.html" + (query || '');
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
