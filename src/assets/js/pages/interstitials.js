$(function(){

    var app_name = storage.getItem(config.storageAppNameKey),
    app_dir = s3AuthObj.rootDirectory + '/' + app_name + 
        (s3AuthObj.type == 'idFed' ? '/' + s3AuthObj.userDirname : ''),
    $adsTable = $('#adsDataTable'),
    ads_tableData = $adsTable.dataTable(),
    $adDlg = $('#adModal');
    if(!app_name)
        return;

    if(awsS3)
        workOnAwsS3();
    else
        $(document).bind('awsS3Initialized', workOnAwsS3);

    function workOnAwsS3()
    {
        updateAdsTable(app_dir, $adsTable, ads_tableData);
        $adDlg.find('.fileinput').each(function()
           {
               this._s3Upload = s3UploadInit($(this), {
                   s3: awsS3,
                   type: 'Image',
                   Bucket: config.s3Bucket,
                   Prefix: function()
                   {
                       var title = $adDlg.find('input[name=Title]').val();
                       return app_dir + '/AAD/' + (title ? title + '/' : '');
                   },
                   signExpires: function()
                   {
                       return awsExpireReverse(config.awsExpireReverseInHours);
                   },
                   onerror: handleAWSS3Error,
                   loadnow: false
               });
           });
    }
    

    $adDlg.on('hidden.bs.modal', function()
         {
             var ad = $adDlg.data('adObj');
             if(ad && typeof ad._tr != 'undefined')
             {
                 var col = adTableColumns[0],
                 col_class = adTableColumns_class[0]
                 
                 ads_tableData.fnUpdate(
                     adTableColumnData(col, ad[col], col_class), 
                     ad._tr, 0, true, false);
             }
             // remove update info
             $adDlg.data('adObj', null)
                 .removeClass('update-ad-dlg')
                 .toggleClass('new-ad-dlg', true);
             $adDlg.find('input[type=text]').each(function()
                {
                    $(this).val('');
                });
             $adDlg.find('.fileinput').each(function()
                {
                    var $this = $(this);
                    $this.find('input[type=file]').val('');
                    $this.toggleClass('fileinput-new', true)
                        .removeClass('fileinput-exists');
                    $this.find('.fileinput-preview img').prop('src', '')
                        .remove();
                });
         });
    $adDlg.find('.set-title-btn').click(function()
         {
             var $title_inp = $adDlg.find('input[name=Title]');
             if(!$title_inp.val())
                 return false;
             $(this).parent().hide();
             $title_inp.prop('disabled', true);
             $adDlg.find('.ad-body-form').show();
             return false;
         });
    $adDlg.on('show.bs.modal', function()
         {
             var ad = $adDlg.data('adObj');
             if(ad)
             {
                 $adDlg.find('.set-title-btn').parent().hide();
                 $adDlg.find('input[name=Title]').prop('disabled', true);
                 $adDlg.find('.ad-body-form').show();
                 $adDlg.find('.fileinput').each(function()
                    {
                        if(this._s3Upload)
                            this._s3Upload.reload();
                    });
             }
             else
             {
                 $adDlg.find('input[name=Title]').prop('disabled', false);
                 $adDlg.find('.set-title-btn').parent().show();
                 $adDlg.find('.ad-body-form').hide();
             }
         });
    $adDlg.find('.action-btn').click(function()
         {
             var ad = $adDlg.data('adObj'),
             $this = $(this);
             if($this.data('isLoading') || !awsS3)
                 return false;
             $this.ladda({}).ladda('start').data('isLoading', true);
             
             ad = ad || {
                 Title: $adDlg.find('input[name=Title]').val()
             };
             saveAdPlist(app_dir, ad, function(err)
                 {
                     $this.ladda('stop').data('isLoading', false);
                     if(err)
                     {
                         handleAWSS3Error(err);
                         return;
                     }
                     alert('Ad has saved successfully!');
                     
                     if(!$adDlg.data('adObj'))
                     {
                         location.reload();
                     }
                 });
             return false;
         });
    function saveAdPlist(app_dir, ad, cb)
    {
        var qlen = 0, qdone = 0, exit_proc,
        aad_dir = app_dir + '/AAD',
        obj = getObjectOfForm($adDlg),
        body = $.plist('toString', obj);
            
        savePlist(aad_dir + '/' + ad.Title + '/Ad.plist');
        if(ad.Status)
            savePlist(aad_dir + '/Ad.plist');
        function continue_job()
        {
            if(++qdone == qlen)
            {
                cb && cb();
            }
        }
        function getObjectOfForm($el)
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
        function savePlist(key)
        {
            qlen++;
            awsS3.putObject({
                Bucket: config.s3Bucket,
                Key: key,
                Body: body
            }, function(err, res)
               {
                   if(exit_proc)
                       return;
                   if(err)
                   {
                       exit_proc = true;
                       return cb && cb(err);
                   }
                   continue_job();
               });
        }
    }
    function updateAdsTable(app_dir, $table, tableData)
    {
        getAdsTableData(app_dir, function(err, ads)
          {
              if(err)
              {
                  handleAWSS3Error(err);
                  return;
              }
              function getAdByRowId(id)
              {
                  var pttrn = /row_([0-9]+)/,
                  match = pttrn.exec(id);
                  if(match)
                  {
                      var index = parseInt(match[1])
                      if(index >= 0)
                          return ads[index];
                  }
              }
              function Status()
              {
                  var col = adTableColumns[2],
                  col_class = adTableColumns_class[2];
                  for(var i = 0, l = ads.length; i < l; ++i)
                  {
                      var ad = ads[i];
                      
                      ads_tableData.fnUpdate(
                          adTableColumnData(col, ad.Status, col_class), 
                          ad._tr, 2, true, false);
                  }
              }
              var statusInProcess;
              function statusBtnClick()
              {
                  var $this = $(this);
                  if(statusInProcess)
                      return false;
                  var item = getAdByRowId($this.parent().parent()[0].id);
                  if(!item)
                      return;
                  // start request
                  $this.toggleClass('disabled', true);
                  statusInProcess = true;
                  toggleAdStatus(app_dir, item, function(err)
                      {
                          $this.removeClass('disabled');
                          statusInProcess = false;
                          if(err)
                              return handleAWSS3Error(err);
                          var b = item.Status;
                          if(b)
                          {
                              for(var i = 0, l = ads.length; i < l; ++i)
                                  ads[i].Status = false;
                              item.Status = true;
                              updateAdsStatus();
                          }
                          $this.toggleClass('btn-success', b)
                              .toggleClass('btn-danger', !b)
                              .html(b ? 'Active' : 'Inactive');
                      });
                  return false;
              }
              function adTRClick()
              {
                  var $this = $(this);
                  if($this.data('isLoading'))
                      return false;
                  $this.data('isLoading', true);
                  function continue_job()
                  {
                      $this.data('isLoading', false);
                      fillDlgInfo(item.info);
                      $adDlg.data('adObj', item)
                          .removeClass('new-ad-dlg')
                          .toggleClass('update-ad-dlg', true)
                          .modal('show');
                  }
                  function fillDlgInfo(info)
                  {
                      $adDlg.find('input[type=text]')
                          .each(function()
                             {
                                 var $this = $(this),
                                 name = $this.attr('name');
                                 for(var key in info)
                                     if(name == key)
                                     {
                                         $this.val(info[key]);
                                         break;
                                     }
                             });   
                  }
                  var item = getAdByRowId(this.id);
                  if(!item)
                      return;
                  if(item.info)
                      continue_job();
                  else
                  {
                      awsS3.getObject({
                          Bucket: config.s3Bucket,
                          Key: aad_dir + '/' + item.Title + '/Ad.plist'
                      }, function(err, res)
                         {
                             if(err)
                             {
                                 $this.data('isLoading', false);
                                 handleAWSS3Error(err);
                                 return;
                             }
                             var xml = $.parseXML(res.Body.toString());
                             item.info = $.plist(xml);
                             continue_job();
                         });
                  }
                  return false;
              }

              var aad_dir =  app_dir + '/AAD',
              columns = adTableColumns,
              columns_class = adTableColumns_class;
              tableData.fnClearTable();
              for(var i = 0, l = ads.length; i < l; ++i)
              {
                  var ad = ads[i],
                  tds = {
                       'DT_RowId': 'row_' + i
                  };
                  
                  for(var c = 0, cl = columns.length; c < cl; ++c)
                  {
                      var col = columns[c];
                      tds[c+''] = adTableColumnData(col, ad[col], 
                                                    columns_class[c]);
                  }
                  
                  ad._tr = tableData.fnAddData(tds, false)[0];
              }
              tableData.fnDraw();
               $table.on('click', 'tbody > tr', adTRClick)
                   .on('click', '.'+columns_class[2], statusBtnClick);
          });
    }
    var adTableColumns = [ 'Image', 'Title', 'Status' ],
    adTableColumns_class = $.map(adTableColumns, encodeStringToClassName);
    function adTableColumnData(key, val, class_name)
    {
        function classStr(b)
        {
            return class_name ? (b ? ' class="' : ' ') + 
                class_name + (b ? '"' : '') : '';
        }
        switch(key)
        {
        case 'Image':
            return '<img src="' + val + '"' + classStr(true) + '/>';
        case 'Status':
            return '<a class="ad-status-btn btn' + 
                classStr(false) + ' ' +
                (val == 1 ? 'btn-success' : 'btn-danger') +
                ' btn-xs text-center"'+
                ' href="#">'+ 
                (val == 1 ? 'Active' : 'Inactive') + '</a>';
        default:
            return '<span' + classStr(true) + '>' + 
                $('<td/>').text(val || '').html() +
                '</span>';
        }
    }
    function getAdsTableData(app_dir, cb)
    {
        function requestComplete()
        {
            if(++qdone == qlen)
            {
                var res = [],
                active_ad_name = active_ad ? active_ad.Title : null;
                for(var i = 0, l = ads.length; i < l; ++i)
                {
                    var ad = ads[i],
                    item = {
                        Image: ads_img[i],
                        Title: ad,
                        Status: active_ad_name == ad
                    };
                    if(item.Status)
                        item.info = active_ad;
                    res.push(item);
                }
                cb(undefined, res);
            }
        }
        function handleRequestWrapper(cb2, exclude_err)
        {
            exclude_err = exclude_err || [];
            return function(err, res)
            {
                if(exit_proc)
                    return;
                if(err)
                {
                    var report_error = true;
                    for(var i = 0, l = exclude_err.length; i < l; ++i)
                        if(err.code == exclude_err[i])
                        {
                            report_error = false;
                            break;
                        }
                    if(report_error)
                    {
                        exit_proc = true;
                        cb(err, res);
                        return;
                    }
                }
                cb2.call(this, err, res);
            }
        }
        var aad_dir = app_dir + '/AAD',
        exit_proc,
        qlen = 2,
        qdone = 0,
        active_ad,
        ads, ads_img = [];
        
        awsS3.getObject({
            Bucket: config.s3Bucket,
            Key: aad_dir + '/Ad.plist'
        }, handleRequestWrapper(function(err, res)
           {
               if(res)
               {
                   var xml = $.parseXML(res.Body.toString());
                   active_ad = $.plist(xml);
               }
               requestComplete();
           }, [ 'NoSuchKey' ]));
        s3ListDirectories(awsS3, {
            Bucket: config.s3Bucket,
            Prefix: aad_dir
        }, handleRequestWrapper(function(err, files)
           {
               function loadAd(i, ad)
               {
                   qlen++;
                   awsS3.getSignedUrl('getObject', {
                       Bucket: config.s3Bucket,
                       Key:  aad_dir + '/' + ad + '/Ad-Landscape~ipad.png',
                       Expires: 
                       awsExpireReverse(config.awsExpireReverseInHours)
                       // helps to cache images for limited time
                   }, function(err, url)
                      {
                          ads_img[i] = url || '';
                          requestComplete();
                      });
               }
               ads = files;
               for(var i = 0, l = ads.length; i < l; ++i)
                   loadAd(i, ads[i])
               requestComplete();
           }));
    }
    function toggleAdStatus(app_dir, item, cb)
    {
        function continue_job()
        {
            if(++qdone == qlen)
            {
                item.Status = !item.Status;
                cb && cb();
            }
        }
        var aad_dir = app_dir + '/AAD',
        qlen = 0, qdone = 0, exit_proc,
        files = [
            'Ad.plist',
            'Ad~iphone.png', 'Ad-568h@2x.png',
            'Ad-Portrait~ipad.png', 'Ad-Landscape~ipad.png',
            'Ad-drawable-port.png', 'Ad-drawable-normal-port.png',
            'Ad-drawable-large-port.png', 'Ad-drawable-large-land.png',
            'Ad-drawable-xlarge-port.png', 'Ad-drawable-xlarge-land.png'
        ];
        for(var i = 0, l = files.length; i < l; ++i)
            performRequestOnFile(files[i]);
        function handleResponse(err, res)
        {
            if(exit_proc)
                return;
            if(err && err.code != 'NoSuchKey')
            {
                exit_proc = true;
                cb(err, res);
                return;
            }
            continue_job();
        }
        function performRequestOnFile(file)
        {
            qlen++;
            awsS3.deleteObject({
                Bucket: config.s3Bucket,
                Key: aad_dir + '/' + file
            }, function(err, res)
               {
                   if(item.Status)
                       handleResponse(err, res)
                   else
                   {
                       if(exit_proc)
                           return;
                       if(err)
                       {
                           exit_proc = true;
                           cb(err, res);
                           return;
                       }
                       awsS3.copyObject({
                           Bucket: config.s3Bucket,
                           Key: aad_dir + '/' + file,
                           CopySource: 
                               encodeURIComponent(config.s3Bucket) + '/' + 
                               encodeURIComponent(aad_dir + '/' + 
                                                  item.Title + '/' + file)
                       }, handleResponse);
                   }
               });
        }
    }
});
