$(function(){
    leftStatusBarUpdate();
})
function leftStatusBarUpdate()
{
    var app_name = storage.getItem(config.storageAppNameKey);
    if(s3AuthObj)
        $('#publisher-name').text(s3AuthObj.rootDirectory);
    
    if(app_name)
        $('#app-list > li').first().text(app_name);
    
    if(s3AuthObj && app_name) {
        $("#app-icon").attr("src", awsS3.getSignedUrl('getObject', {
            Bucket: config.s3Bucket,
            Key:  s3AuthObj.rootDirectory + "/" + app_name +
                "/APP/SOURCES/iOS/Icon.png"
        }));

        $("#app-icon").error(function() {
            $("#app-icon").attr("src", "assets/img/no-icon.png");
        });
    }

}
