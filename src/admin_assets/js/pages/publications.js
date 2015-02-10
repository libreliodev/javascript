var appName = storage.getItem(config.storageAppNameKey),
appDir = get_app_dir(appName),
setup_obj;
$(function() {
    function workOnAwsS3()
    {
        formDisplay();
        $pubDlg.find('.fileinput').each(initUploadEl);
        awsS3.getObject({
          Bucket: config.s3Bucket,
          Key: appDir + '/APP_/Uploads/setup.plist'
        }, function(err, res)
           {
               if(err && err.code != 'NoSuchKey')
               {
                   handleAWSS3Error(err)
                   return;
               }
               var obj = res ? $.plist($.parseXML(res.Body.toString())) : {};
               setup_obj = obj;
               if(setup_obj.PublicationType != 'multiple')
               {
                 document.location = 'issues.html';
                 return;
               }
               updatePubTable(function()
                 {
                   $('#page-loading-indicator2').fadeOut();
                 });
           });
    }
    var $pubTable = $(".publicationDataTable"),
    publicationsTable = $pubTable.dataTable({
        "aaSorting": [[ 0, "desc" ]]
    }),
    $pubDlg = $('#pubModal');
  
    activeInactiveEvents($pubTable);
    if(!appName)
        return;
    
    awsS3Ready(workOnAwsS3);
    

    function uploadElEvalFilename(el, action)
    {
        var pub = $pubDlg.data('pubObj'),
        $this = $(el),
        ext = el.files && el.files.length > 0 ?
            path.fileExtension(el.files[0].name) : '';
        if(pub)
        {
            // use existing extension
            // if it's there
            if($this.hasClass('paidfileupload'))
                ext = (action == 'delete') ? pub.paid_ext || ext :
                ext || pub.paid_ext;
            else if($this.hasClass('freefileupload'))
                ext = (action == 'delete') ? pub.free_ext || ext :
                ext || pub.free_ext;
        }
        return pubDlgEvalAttr($this.attr('name'), { fileext: ext });
    }
    function initUploadEl()
    {
        var $upload = $(this),
        $file = $upload.find('input[type=file]');
        this._s3Upload = s3UploadInit($upload, {
            s3: awsS3,
            type: $file.data('type') || 'file',
            Bucket: config.s3Bucket,
            removeBeforeChange: pubDlgAttrHasVar($file.attr('name'), 'fileext'),
            Key: function(action)
            {
                var title = $pubDlg.find('input[name=FolderName]').val(),
                file = uploadElEvalFilename(this, action);
                return appDir + '/' + title + '/' + file;
            },
            signExpires: function()
            {
                return awsExpireReverse(config.awsExpireReverseInHours);
            },
            onUploadSuccess: function()
            {
                pubDlgUpdated = true;
                uploadFileUpdateExtension(this);
            },
            onRemoveSuccess: function()
            {
                pubDlgUpdated = true;
                uploadFileUpdateExtension(this);
            },
            onFileExistCheck: function(exists)
            {
              
            },
            checkBeforeUpload: function(inp_el, file, cb)
            {
              if($(inp_el).data('type') == 'Image')
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
              {
                cb(true);
              }
            },
            onerror: handleAWSS3Error,
            loadnow: false
        });
    }
    var pubDlgUpdated;
    $pubDlg.on('hidden.bs.modal', function()
         {
             var pub = $pubDlg.data('pubObj');
             if(pubDlgUpdated)
             {
                 location.reload();
                 return;
             }
             // remove update info
             $pubDlg.data('pubObj', null)
                 .removeClass('update-pub-dlg')
                 .toggleClass('new-pub-dlg', true);
             $pubDlg.find('input[type=text]').each(function()
                {
                    $(this).val('');
                });
             $pubDlg.find('.fileinput').each(function()
                {
                    var $this = $(this);
                    $this.find('input[type=file]').val('');
                    $this.toggleClass('fileinput-new', true)
                        .removeClass('fileinput-exists');
                    $this.find('.fileinput-preview img').prop('src', '')
                        .remove();
                });
             
         });
    var illegalPubs = [ "AAD", "APP__", "APP_", "APP_", "APW_" ];
    $pubDlg.find('.set-title-btn').click(function()
         {
             var $this = $(this);
             if($this.data('isLoading') || !awsS3)
                 return false;
             var $title_inp = $pubDlg.find('input[name=FolderName]'),
             title_val = $title_inp.val();
             if(!title_val)
                 return false;
             var allowed_pattrn = /^[a-z0-9\-_]+$/;
             if(illegalPubs.indexOf(title_val) >= 0 ||
                !allowed_pattrn.test(title_val))
             {
                 notifyUserError(_('Invalid publication name!'));
                 return false;
             }
             $this.ladda({}).ladda('start').data('isLoading', true);
             $title_inp.prop('disabled', true);
             s3ObjectExists(awsS3, {
                 Bucket: config.s3Bucket,
                 Prefix: appDir + '/' + title_val + '/'
             }, function(err, exists)
                {
                    $this.ladda('stop').data('isLoading', false);
                    if(err)
                    {
                        handleAWSS3Error(err);
                        return;
                    }
                    if(!exists)
                    {
                        awsS3.putObject({
                          Bucket: config.s3Bucket,
                          Key: appDir + '/' + title_val + '/' + 
                            title_val + '.plist',
                          Body: $.plist('toString', [])
                        }, function(err, data) {
                          
                          if(err)
                          {
                            $title_inp.prop('disabled', false);
                            return handleAWSS3Error(err);
                          }
                          
                          pubDlgUpdated = true;
                          $(this).parent().hide();
                          $pubDlg.find('.pub-body-form').show();
                        });
                    }
                    else
                    {
                        $title_inp.prop('disabled', false);
                        notifyUserError(_('Folder exists!'));
                    }
                });
             return false;
         });
    $pubDlg.on('show.bs.modal', function()
         {
             pubDlgUpdated = false;
             var pub = $pubDlg.data('pubObj');
             $pubDlg.find('input[type=file]').prop('disabled', false);
             if(pub)
             {
                 var pub_name = pub.FileName;
                 $pubDlg.find('.set-title-btn').parent().hide();
                 $pubDlg.find('input[name=FolderName]').prop('disabled', true);
                 $pubDlg.find('.pub-body-form').show();
                 $pubDlg.find('.fileinput').each(function()
                    {
                      if(this._s3Upload)
                          this._s3Upload.reload();
                    });
             }
            else
             {
                 $pubDlg.find('input[name=FolderName]').prop('disabled', false);
                 $pubDlg.find('.set-title-btn').parent().show();
                 $pubDlg.find('.pub-body-form').hide();
             }
         });
    function pubDlgEvalAttr(s, vars)
    {
        s = s+'';
        vars = $.extend(false, getObjectOfForm($pubDlg), vars);
        for(var i in vars)
        {
            var name = '*'+i+'*',
            val = vars[i];
            for(var n = 0, idx; (idx = s.indexOf(name, n)) >= 0; 
                n = idx + name.length)
            {
                if(idx == 0 || s[idx-1] != '\\')
                    s = s.substr(0, idx) + val + s.substr(idx + name.length);
            }
        }
        return s.replace('\\*', '*');
    }
    function pubDlgAttrHasVar(s, vr)
    {
        var idx = s.indexOf('*'+vr+'*');
        return idx == 0 || (idx > 0 && s[idx-1] != '\\');
    }
    
    function updatePubTable(callback)
    {
        s3ListAllObjects(awsS3, {
                Bucket: config.s3Bucket,
                Prefix: appDir + '/',
                Delimiter: '/'
            },
            function(error, apps) {

                awsS3.getObject({
                    Bucket: config.s3Bucket,
                    Key: appDir+'/Magazines.plist'
                }, function(err, activated) {
                    var appsList = apps.CommonPrefixes,
                    activeList;
                    try {
                        activeList = $.plist($.parseXML(activated.Body.toString()));
                    }catch(e) {
                        activeList = [];
                    }
                    var activeListLength = activeList.length;

                    var rowsList = [];
                    var temp = {};
                    var count = 0;

                    for(var i = 0; i < appsList.length; ++i) {

                        //---------------------------------------------------
                        // We have 3 unwanted folders...
                        // ignore them and don't show them on the list
                        //---------------------------------------------------

                        if (isolateFolderName(appsList[i].Prefix) == "AAD" ||
                            isolateFolderName(appsList[i].Prefix) == "APP__" ||
                            isolateFolderName(appsList[i].Prefix) == "APP_" ||
                            isolateFolderName(appsList[i].Prefix) == "APP_" ||
                            isolateFolderName(appsList[i].Prefix) == "APW_") {
                            continue;
                        }

                        //---------------------------------------------------
                        // Prepear a single row object with default value
                        //---------------------------------------------------

                        temp[count] = {
                            FileName: isolateFolderName(appsList[i].Prefix),
                            FolderName: isolateFolderName(appsList[i].Prefix),
                            Title: "",
                            Subtitle: "",
                            status: "inactive",
                            statusBtn: "<a data-filename='" + isolateFolderName(appsList[i].Prefix) + "' class='btn  btn-danger btn-xs text-center btnActive' href='#'>"+_("Inactive")+"</a>",
                            id: 0
                        }
                        for(var j = 0; j < activeListLength; ++j) {

                            //---------------------------------------------------
                            // There sometimes undefined keys is the object...
                            // it cause because of inactive publications...
                            // it's shouldn't happen, but we do taking
                            // care of it, so the front end user wont have any
                            // errors... jus in case...
                            //---------------------------------------------------

                            /*if (activeList[j] == undefined) {
                             continue;
                             }*/

                            //---------------------------------------------------
                            // Does the folder name fit each other?
                            // if so update this publication title, subtitle
                            // and status
                            //---------------------------------------------------

                            if (activeList[j].FileName == temp[count].FileName) {
                                temp[count].Title = activeList[j].Title;
                                temp[count].Subtitle = activeList[j].Subtitle;
                                temp[count].status = "active";
                                temp[count].statusBtn = "<a data-filename='" + isolateFolderName(appsList[i].Prefix) + "' data-id='" + j + "' class='btn  btn-success btn-xs text-center btnInactive' href='#'>"+_("Active")+"</a>";
                                temp[count].id = j;
                                added = true;
                                break;
                            }
                        }

                        rowsList.push(temp[count]);
                        count++;
                    }
                    function getPubByRowId(id)
                    {
                        var pttrn = /row_([0-9]+)/,
                        match = pttrn.exec(id);
                        if(match)
                        {
                            var index = parseInt(match[1])
                            if(index >= 0)
                                return rowsList[index];
                        }
                    }
                    function pubEditClick()
                    {
                        var item = getPubByRowId(this.parentNode.parentNode.id);
                        if(!item)
                            return;
                        awsS3.listObjects({
                            Bucket: config.s3Bucket,
                            Prefix: appDir + '/' + item.FolderName + '/' +
                                item.FolderName
                        }, function(err, res)
                           {
                               if(err)
                               {
                                   handleAWSS3Error(err);
                                   return;
                               }
                               function getKeySub(item)
                               {
                                   return item.Key.substr(prefLen);
                               }
                               var prefLen = res.Prefix.length,
                               free = startsWith(res.Contents, '.', getKeySub),
                               paid = startsWith(res.Contents, '_.', getKeySub);
                               item = $.extend(false, {}, item);
                               
                               item.free_ext = free.length > 0 ? 
                                   free[0].Key.substr(prefLen) : null;
                               item.paid_ext = paid.length > 0 ? 
                                   paid[0].Key.substr(prefLen + 1) : null;
                               
                               $pubDlg.find('input[type=text]')
                                   .each(function()
                                    {
                                        var $this = $(this),
                                        name = $this.attr('name');
                                        for(var key in item)
                                            if(name == key)
                                        {
                                            $this.val(item[key]);
                                            break;
                                        }
                                    });
                               $pubDlg.data('pubObj', item)
                                   .removeClass('new-pub-dlg')
                                   .toggleClass('update-pub-dlg', true)
                                   .modal('show');
                           });
                        return false;
                    }
                    function pubTRClick()
                    {
                        var item = getPubByRowId(this.id);
                        if(!item)
                            return;
                        document.location = 'issues.html?wapublication=' + 
                            encodeURIComponent(item.FolderName);
                        return false;
                    }
                    //---------------------------------------------------
                    // Add the rows to the table
                    //---------------------------------------------------

                    for(var i = 0; i < rowsList.length; ++i) {
                        addRowToTable(i, rowsList[i], publicationsTable);
                    }

                    //---------------------------------------------------
                    // Apply events for the active/inactive buttons
                    //---------------------------------------------------

                    
                    $pubTable.on('click', 'tbody > tr', pubTRClick);
                    $pubTable.on('click', '.edit-btn', pubEditClick);

                    callback && callback();
                });
            });
    }
    function isolateFolderName(name) {
        return name.replace(appDir + '/', "").replace("/", "");
    }

    function isolateFolderName2(name) {
        return name.substring(	name.indexOf("/")+1, name.length-5);
    }

    function isolateFolderName3(name) {
        return name.substring(	name.indexOf("/")+1, name.length-4);
    }

});

function formDisplay() {
    $("input[name='folderName']").bind("keyup", function() {
        $(".hiddenFields").show();
    });
}

function activeInactiveEvents(publicationsTable) {

    publicationsTable.on("click", "a.btnActive", {}, function(e) {
        e.preventDefault();
        var obj = $(this);
        activePublication(obj, publicationsTable);
        return false;
    });

    publicationsTable.on("click", "a.btnInactive", {}, function(e) {
        e.preventDefault();
        var obj = $(this);
        inactivePublication(obj, publicationsTable);
        return false;
    });
}

function activePublication(obj, publicationsTable) {
    var some_html = '<form class="form-horizontal"> <div class="form-group"> ' +
        '<label class="control-label col-lg-4">'+_('Title')+'</label> ' +
        '<div class="col-lg-8"> ' +
        '<input type="text" name="pubTitleInput" /> ' +
        '</div> ' +
        '</div>';
    some_html += '<div class="form-group"> ' +
        '<label class="control-label col-lg-4">'+_('Subtitle')+'</label> ' +
        '<div class="col-lg-8"> ' +
        '<input type="text" name="pubSubtitleInput" /> ' +
        '</div> ' +
        '</div></form>';

    bootbox.dialog({
        message: some_html,
        title: "Confirmation",
        className: "littleModal",
        buttons: {
            success: {
                label: "Confirm",
                className: "btn-success",
                callback: function() {
                    activeServerRequest(obj, publicationsTable);
                }
            },
            danger: {
                label: "Cancel",
                className: "btn-danger",
                callback: function() {}
            }
        }
    });
}

function inactivePublication(obj, publicationsTable) {
    bootbox.dialog({
        message: "Are you sure you want to inactive this publication?",
        title: "Confirmation",
        className: "littleModal",
        buttons: {
            success: {
                label: "Confirm",
                className: "btn-success",
                callback: function() {
                    inactiveServerRequest(obj, publicationsTable);
                }
            },
            danger: {
                label: "Cancel",
                className: "btn-danger",
                callback: function() {}
            }
        }
    });
}
function activeServerRequest(obj, publicationsTable) {
    
    var pTitle = $("input[name='pubTitleInput']").val();
    var pSubtitle = $("input[name='pubSubtitleInput']").val();

    awsS3.getObject({
        Bucket: window.config.s3Bucket,
        Key: appDir+'/Magazines.plist'
    }, function(err, activated) {
        //var activeList = PlistParser.parse($.parseXML(activated.Body.toString()));
        var activeList;
        try {
            activeList = $.plist($.parseXML(activated.Body.toString())) || [];
        }catch(e) {
            activeList = [];
        }
        var pub = {
          FileName: obj.data("filename"),
          Title: pTitle,
          Subtitle: pSubtitle
        };
        insertPubInList(pub, activeList);
            
        var body = $.plist('toString', activeList);
        

        var params = {
          Bucket: config.s3Bucket, // required
          Key: appDir+'/Magazines.plist',
          //Body: PlistParser.toPlist(activeList)
          Body: body
        };
        awsS3.putObject(params, function(err, data) {
          if (err) {
            return handleAWSS3Error(err);
          } else {
            //obj.addClass("btnInactive").addClass("btn-danger").removeClass("btnActive").removeClass("btn-success").html("Inactive").data("id", activeListLength);
            //publicationsTable.fnGetPosition( obj.parents('tr').closest('.ttitle')[0]).html(pTitle);
            //publicationsTable.fnGetPosition( obj.parents('tr').closest('.tsubtitle')[0]).html(pSubtitle);
            location.reload();
          }
        });
    });
}

function inactiveServerRequest(obj, publicationsTable) {

    awsS3.getObject({
        Bucket: window.config.s3Bucket,
        Key: appDir+'/Magazines.plist'
    }, function(err, activated) {

        var tmp = obj.data('filename'),
        activeList;
        try {
            activeList = $.plist($.parseXML(activated.Body.toString()));
        }catch(e) {
            activeList = [];
        }
        var filenames = [
            tmp + '/' + tmp + '_.pdf',
            tmp + '/' + tmp + '.pdf'
        ];

        for(var i = 0; i < activeList.length; )
            if(filenames.indexOf(activeList[i].FileName) != -1)
                activeList.splice(i, 1);
        else
            i++;
        var body = $.plist('toString', activeList);
        
        //var rowIndex = publicationsTable.fnGetPosition( obj.closest('tr')[0] );
        //publicationsTable.fnDeleteRow(rowIndex);

        var params = {
            Bucket: window.config.s3Bucket, // required
            Key: appDir+'/Magazines.plist',
            //Body: PlistParser.toPlist(activeList)
            Body: cleanKeys($.plist('toString', activeList))
        };
        window.awsS3.putObject(params, function(err, data) {
            if (err) {
                alert();
            } else {
                //obj.removeClass("btnInactive").removeClass("btn-danger").addClass("btnActive").addClass("btn-success").html("Active").data("id", 0);
                //publicationsTable.fnGetPosition( obj.parents('tr').closest('.ttitle')[0]).html("");
                //publicationsTable.fnGetPosition( obj.parents('tr').closest('.tsubtitle')[0]).html("");
                location.reload();
            }
        });
    });
}

function addRowToTable(index, data, publicationsTable) {
    publicationsTable.fnAddData( {
        'DT_RowId': 'row_' + index,
        '0': data.FileName,
        '1': "<span class='ttitle'>" + data.Title + "</span>",
        '2': "<span class='tsubtitle'>" + data.Subtitle + "</span>",
        '3': '<a class="edit-btn btn-lg"><i class="glyphicon glyphicon-edit"></i></a>',
        '4': data.statusBtn
    });
}


function deleteFromObject(obj, deleteValue) {
    var objToArray = $.map(obj, function(value, index) {
        return [value];
    });

    for (var i = 0; i < objToArray.length; ++i) {
        if (objToArray[i] == deleteValue) {
            objToArray.splice(i, 1);
            i--;
        }
    }

    return ArrayToObject(objToArray);
}

function ArrayToObject(arr) {
    var rv = {};
    for (var i = 0; i < arr.length; ++i)
        rv[i] = arr[i];
    return rv;
}

function cleanKeys(obj) {
    //return obj.replace("\<key\>\d+\<\/key\>\n\<dict\>", "<dict>");
    return obj.replace(/\n\<key\>\d+\<\/key\>\n\<dict\>/g, "\n<dict>");
}

function insertPubInList(pub, list)
{
    var pubfn = pub.FileName;
    // replace publications or add it
    for(var i = 0, l = list.length; i < l; )
    {
        var item = list[i];
        if(item && item.FileName == pubfn)
            list.splice(i, 1);
        else
            i += 1;
    }
    list.unshift(pub);
}
