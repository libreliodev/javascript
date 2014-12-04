$(function(){
    var app_name = storage.getItem(config.storageAppNameKey),
    app_dir = get_app_dir(app_name),
    $page = $('#setup-wrapper'),
    setup_file_path = $page.data('setup-file-path'),
    upload_dir = $page.data('upload-dir') || '';
    if(!app_name)
        return;
    awsS3Ready(workOnAwsS3);
    if(setup_file_path)
      setupPageInit();
    function workOnAwsS3()
    {
        if(setup_file_path)
          loadSetupPage(app_dir, $page);
        $page.find('.fileinput').each(function()
           {
               s3UploadInit($(this), {
                   s3: awsS3,
                   type: 'Image',
                   Bucket: config.s3Bucket,
                   Prefix: app_dir + '/' + upload_dir,
                   checkBeforeUpload: function(inp_el, file, cb)
                   {
                     makeImageFromFile(file, function(err, image)
                       {
                         if(err)
                           return notifyUserError(err);
                         var m = validateImageSizeByElementAttrs(inp_el, image);
                         cb(!m);
                         if(m)
                           notifyUserError(m);
                       });
                   },
                   signExpires: function()
                   {
                       return awsExpireReverse(config.awsExpireReverseInHours);
                   },
                   onerror: handleAWSS3Error
               });
           });
    }
  function setupPageInit()
  {
    var isSaving = false;
    $page.find('input[type=text], textarea').prop('disabled', true);
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
  }
    function loadSetupPage(app_dir, $page, cb)
    {
        $page.find('input[type=text], textarea').prop('disabled', true);
        // load setup plist file and set its content in the form
        awsS3.getObject({
            Bucket: config.s3Bucket,
            Key: app_dir + '/' + setup_file_path,
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
               $inps = $page.find('input[type=hidden], input[type=text], textarea');
               for(var key in obj)
               {
                   $inps.each(function()
                      {
                          var $this = $(this);
                          if($this.attr('name') == key && obj[key])
                          {
                              switch($this.data('type'))
                              {
                              case 'BOOL':
                                  $this.val(obj[key] ? 'True' : 'False');
                                  break;
                              default:
                                  $this.val(obj[key]);
                              }
                          }
                      });
               }
           });
    }
    function saveSetupPlist(app_dir, $page, cb)
    {
        function getObjectOfSetupPage($el)
        {
            var ret = {};
            $el.find('input[type=hidden], input[type=text], textarea')
                .each(function()
                  {
                      var $this = $(this),
                      val = $this.data('value') ||
                          $this.val() || '';
                      switch($this.data('type'))
                      {
                      case 'BOOL':
                          ret[$this.attr('name')] = val == 'True' ? true : false;
                          break;
                      default:
                          ret[$this.attr('name')] = val;
                      }
                  });
            return ret;
        }
        // get attrs
        var obj = getObjectOfSetupPage($page),
        body = $.plist('toString', obj);
        // save setup plist file for input app
        awsS3.putObject({
            Bucket: config.s3Bucket,
            Key: app_dir + '/' + setup_file_path,
            Body: body,
            CacheControl: 'must-revalidate, max-age=0'
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
