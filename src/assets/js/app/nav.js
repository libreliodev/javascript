$(function(){
    $('#logout-anchor').click(function()
       {
           userLogout();
       });
    
    // app-list dropdown impl
    /* load app's list and remove loading sign */
    if(s3AuthObj && awsS3)
    {
        s3ListDirectories(awsS3, {
            Bucket: config.s3Bucket,
            Prefix: s3AuthObj.rootDirectory + '/'
        }, function(err, apps)
           {
               if(err)
               {
                   handleAWSS3Error(err);
                   return;
               }
               function add_app(app)
               {
                   $('<li/>').append(
                       $('<a/>').attr('href', '#')
                           .text(app)
                           .click(function()
                             {
                                 storage.setItem(config.storageAppNameKey, app);
                                 list_dropdown.dropdown('toggle');
                                 location.reload();
                                 return false;
                             })).appendTo(list_dropdown);
               }
               var list_dropdown = $('#app-list-dropdown');
               list_dropdown.children().remove();
               for(var i = 0, l = apps.length; i < l; ++i)
                   add_app(apps[i]);

               if(!storage.getItem(config.storageAppNameKey) &&
                  apps.length > 0)
               {
                   storage.setItem(config.storageAppNameKey, apps[0]);
                   location.reload();
               }
               $('#app-list-dropdown-toggle .loading').hide();
           });
    }
});
