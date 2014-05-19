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
    
    if(app_name) {
        if(awsS3)
            setAppIcon();
        else
            $(document).bind('awsS3Initialized', setAppIcon);
    }
    function setAppIcon()
    {
        awsS3.getSignedUrl('getObject', {
            Bucket: config.s3Bucket,
            Key:  s3AuthObj.rootDirectory + "/" + app_name +
                "/APP/SOURCES/iOS/Icon.png"
        }, function(err, url)
           {
               if(err)
                   return;
               $("#app-icon").attr("src", url);
               $("#app-icon").error(function() {
                   $("#app-icon").attr("src", "assets/img/no-icon.png");
               });
           });
    }
    if(s3AuthObj.type == 'idFed')
    {
        $(function(){
            // show some of menu items
            var show_links = [ 'setup.html', 'publications.html' ];
            $('#menu > li > a').each(function()
                {
                    var $a = $(this);
                    if(show_links.indexOf($a.attr('href')) == -1)
                        $a.parent().remove();
                });
        });
    }
}
