$(function(){
    var app_name = storage.getItem(config.storageAppNameKey),
    app_dir = get_app_dir(app_name);
    $page = $('#setup-wrapper');
    if(!app_name)
        return;
    awsS3Ready(workOnAwsS3);
    function workOnAwsS3()
    {
        loadSetupPage(app_dir, $page);
        $page.find('.fileinput').each(function()
           {
               s3UploadInit($(this), {
                   s3: awsS3,
                   type: 'Image',
                   Bucket: config.s3Bucket,
                   Prefix: app_dir + '/APP_/Uploads/',
                   signExpires: function()
                   {
                       return awsExpireReverse(config.awsExpireReverseInHours);
                   },
                   onerror: handleAWSS3Error
               });
           });
    }
    var isSaving = false;
    $page.find('input[type=text], textarea')
        .bind('focus', function()
           {
               $(this).data('prev_value', $(this).val());
           })
        .bind('blur', function()
           {
               var $this = $(this),
               prev_val = $this.data('prev_value'),
               val = $this.val();
               if(!awsS3)
                   return;
               if(prev_val != val)
               {
                   $this.prop('disabled', true);
                   $this.val(_('Saving...'))
                       .data('value', val);
                   if(isSaving)
                   {
                       var dataSaved;
                       $page.bind('setupPlistSaved', function()
                          {
                              if(!isSaving && !dataSaved)
                              {
                                  $page.unbind('setupPlistSaved', 
                                               arguments.callee);
                                  isSaving = true;
                                  saveSetupPlist(app_dir, $page, save_handler);
                              }
                              else if(dataSaved)
                              {
                                  $this.prop('disabled', false);
                                  $this.val(val);
                                  $page.unbind('setupPlistSaved', 
                                               arguments.callee);
                              }
                              else
                              {       
                                  dataSaved = true;
                              }
                          });
                       return;
                   }
                   isSaving = true;
                   saveSetupPlist(app_dir, $page, save_handler);
                   function save_handler(res)
                   {
                       $this.prop('disabled', false);
                       $this.val(val)
                           .data('value', null);
                       
                       isSaving = false;
                       $page.trigger('setupPlistSaved', res);
                   }
               }
           });
    function loadSetupPage(app_dir, $page, cb)
    {
        $page.find('input[type=text], textarea').prop('disabled', true);
        // load setup plist file and set its content in the form
        awsS3.getObject({
            Bucket: config.s3Bucket,
            Key: app_dir + '/APP_/Uploads/setup_.plist',
            ResponseContentEncoding: 'utf8'
        }, function(err, res)
           {
               $page.find('input[type=text], textarea').prop('disabled', false);
               if(err && err.code != 'NoSuchKey')
               {
                   handleAWSS3Error(err)
                   return;
               }
               var obj = res ? $.plist($.parseXML(res.Body.toString())) : {},
               $inps = $page.find('input[type=text], textarea');
               for(var key in obj)
               {
                   $inps.each(function()
                      {
                          var $this = $(this);
                          if($this.attr('name') == key && obj[key])
                              $this.val(obj[key]);
                      });
               }
           });
    }
    function saveSetupPlist(app_dir, $page, cb)
    {
        function getObjectOfSetupPage($el)
        {
            var ret = {};
            $el.find('input[type=text], textarea')
                .each(function()
                  {
                      var $this = $(this);
                      ret[$this.attr('name')] = $this.data('value') ||
                          $this.val() || '';
                  });
            return ret;
        }
        // get attrs
        var obj = getObjectOfSetupPage($page),
        body = $.plist('toString', obj);
        // save setup plist file for input app
        awsS3.putObject({
            Bucket: config.s3Bucket,
            Key: app_dir + '/APP_/Uploads/setup_.plist',
            Body: body
        }, function(err, res)
           {
               if(err)
               {
                   handleAWSS3Error(err);
                   return;
               }
               if(cb)
                   cb(res);
           });
    }
});
