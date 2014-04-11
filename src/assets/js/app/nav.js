$(function(){
    $('#logout-anchor').click(function()
       {
           if(storage)
               storage.setItem(config.storageAuthKey, '');
       });
    
    // app-list dropdown impl
    /* load app's list and remove loading sign */
    if(s3AuthObj && awsS3)
    {
        s3ListAllObjects(awsS3, {
            Bucket: config.s3Bucket,
            Prefix: s3AuthObj.rootDirectory + '/',
            Delimiter: '/'
        }, function(err, res)
           {
               var apps = [],
               cprefixes = res.CommonPrefixes,
               pttrn = /[^\/]+/,
               prefix = s3AuthObj.rootDirectory + '/';
               
               for(var i = 0, l = cprefixes.length; i < l; ++i)
               {
                   var dir = cprefixes[i].Prefix,
                   match;
                   if(dir.indexOf(prefix) == 0 && 
                      (match = pttrn.exec(dir.substr(prefix.length))) &&
                      apps.indexOf(match[0]) < 0)
                       apps.push(match[0]);
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
