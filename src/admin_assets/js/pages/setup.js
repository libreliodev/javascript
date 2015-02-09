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
               var $file = $(this).find('input[type=file]'),
               ftype = $file.data('type') || 'Image';
               s3UploadInit($(this), {
                   s3: awsS3,
                   type: ftype,
                   Bucket: config.s3Bucket,
                   Prefix: app_dir + '/' + upload_dir,
                   checkBeforeUpload: function(inp_el, file, cb)
                   {
                     if(ftype == 'Image')
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
                     }
                     else
                       cb(true);
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
      var savingObj;
      $page.find('input[type=text], textarea, select').prop('disabled', true);
      $page.find('input[type=text], textarea, select')
          .bind('focus', function()
            {
                $(this).data('prev_value', $(this).val());
            });
      $page.find('input[type=text], textarea')
          .bind('blur', input_element_change_check);
      $page.find('select').bind('change', input_element_change_check);
      function input_element_change_check()
      {
          var $this = $(this),
          saving_el,
          prev_val = $this.data('prev_value'),
          val = $this.val();
          if(prev_val != val)
          {
              $this.prop('disabled', true)
                  .data('value', val+'');
              if(this.nodeName == 'SELECT')
              {
                  saving_el = $('<option/>');
                  saving_el.attr('value', '__saving__');
                  saving_el.text(_('Saving...'));
                  $this.append(saving_el);
                  $this.val('__saving__');
              }
              else
              {
                  $this.val(_('Saving...'))
              }
              setupSettingHasChanged(function()
                {
                    $this.prop('disabled', false);
                    $this.val(val)
                        .data('value', null);
                    if($this[0].nodeName == 'SELECT')
                        saving_el.remove();
                });
          }
      }
    function setupSettingHasChanged(cb)
    {
        if(savingObj)
            savingObj.abort();
        $(document).bind('setupSettingSaved', saved_cb);
        savingObj = saveSetupPlist(app_dir, $page, save_handler);
        function saved_cb()
        {
            $(document).unbind('setupSettingSaved', saved_cb);
            cb && cb();
        }
        function save_handler()
        {
            savingObj = null;
            $(document).unbind('setupSettingSaved', saved_cb);
            $(document).trigger('setupSettingSaved');
            cb && cb();
        }
    }
  }
  
    function loadSetupPage(app_dir, $page, cb)
    {
        $page.find('input[type=text], textarea').prop('disabled', true);
        // load setup plist file and set its content in the form
        return awsS3.getObject({
            Bucket: config.s3Bucket,
            Key: app_dir + '/' + setup_file_path,
            ResponseContentEncoding: 'utf8'
        }, function(err, res)
           {
               $page.find('input[type=text], textarea, select').prop('disabled', false);
               if(err && err.code != 'NoSuchKey')
               {
                   handleAWSS3Error(err)
                   return;
               }
               var obj = res ? $.plist($.parseXML(res.Body.toString())) : {},
               $inps = $page.find('input[type=hidden], input[type=text], textarea, select');
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
                                  $this.val(obj[key] || '');
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
            $el.find('input[type=hidden], input[type=text], textarea, select')
                .each(function()
                  {
                      var $this = $(this),
                      val = typeof $this.data('value') == 'string' ? 
                        $this.data('value') : $this.val() || '';
                      switch($this.data('type'))
                      {
                      case 'BOOL':
                          ret[$this.attr('name')] = val == 'True' ? true : false;
                          break;
                      default:
                        if(typeof $this.data('null-if-empty') == 'undefined' ||
                           val.length > 0)
                          ret[$this.attr('name')] = val;
                      }
                  });
            return ret;
        }
        // get attrs
        var obj = getObjectOfSetupPage($page),
        body = $.plist('toString', obj);
        // save setup plist file for input app
        return awsS3.putObject({
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
