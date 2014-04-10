$(function(){
    $('#logout-anchor').click(function()
       {
           if(supports_html5_storage())
               localStorage.setItem(config.localStorageAuthKey, null);
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
                      (match = pttrn.exec(dir.substr(prefix.length))))
                       apps.push(match[0]);
               }
               function add_app(app)
               {
                   $('<li/>').append(
                       $('<a/>').attr('href', '#')
                           .text(app)
                           .click(function()
                             {
                                 changeApplication(app);
                                 list_dropdown.dropdown('toggle');
                                 return false;
                             })).appendTo(list_dropdown);
               }
               var list_dropdown = $('#app-list-dropdown');
               list_dropdown.children().remove();
               for(var i = 0, l = apps.length; i < l; ++i)
                   add_app(apps[i]);
               
               $('#app-list-dropdown-toggle .loading').hide();
           });
        /*
        awsS3.listObjects({
            Bucket: config.s3Bucket,
            Prefix: s3AuthObj.rootDirectory + '/',
            Delimiter: '/'
        }, function(err, res)
           {
               $('#app-list-dropdown-toggle .loading').hide();
               console.log(err, res);
           });
        */
    }
});
