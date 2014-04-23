$(function() {

    formDisplay();

    var appName = storage.getItem(config.storageAppNameKey),
    appDir = s3AuthObj.rootDirectory + '/' + appName,
    $pubTable = $(".publicationDataTable"),
    publicationsTable = $pubTable.dataTable(),
    $pubDlg = $('#pubModal');
    if(!appName)
        return;
    $("#asset-uploader").pluploadQueue({
        // General settings
        runtimes: 'html5,flash,silverlight,html4',
        url: 'https://' + config.s3Bucket + '.s3.amazonaws.com',
        multipart: true,
        
        // Resize images on clientside if we can
        resize : {
            width : 200,
            height : 200,
            quality : 90,
            crop: true // crop to exact dimensions
        },
 
        // Rename files by clicking on their titles
        rename: true,
         
        // Sort files
        sortable: true,
 
        // Enable ability to drag'n'drop files onto the widget (currently only HTML5 supports that)
        dragdrop: true,
 
        // Views to activate
        views: {
            list: true,
            thumbs: true, // Show thumbs
            active: 'thumbs'
        },
 
        // Flash settings
        flash_swf_url : 'assets/lib/plupload/Moxie.swf',
     
        // Silverlight settings
        silverlight_xap_url : 'assets/lib/plupload/Moxie.xap'
    });
    var asset_uploader = $("#asset-uploader").pluploadQueue();
    asset_uploader.bind("BeforeUpload", function(up,file) {
        var params = asset_uploader.settings.multipart_params;
        params.key = $("#asset-uploader").data('current_dir') + file.name;
        params.Filename = file.name;
    });
    function setPLUploadInfoForPub(pub)
    {
        var d = new Date(new Date().getTime() + (60 * 60 * 1000)),
        dir = appDir + '/' + pub + '/' + $("#asset-uploader").data('dir') + '/',
        policy = {
            "expiration": d.toISOString(),
            "conditions": [ 
                {"bucket": config.s3Bucket}, 
                ["starts-with", "$key", dir],
                {"acl": "private"},
                ["starts-with", "$Content-Type", ""],
                ["starts-with", "$name", ""],
                ["starts-with", "$Filename", ""],
                ["starts-with", "$success_action_status", ""]
            ]
        },
        policy_str = CryptoJS.enc.Base64.stringify(
            CryptoJS.enc.Utf8.parse(JSON.stringify(policy))),
        signature = CryptoJS.HmacSHA1(policy_str, s3AuthObj.secretAccessKey)
            .toString(CryptoJS.enc.Base64);
        var post = {
            acl: 'private',
            AWSAccessKeyId: s3AuthObj.accessKeyId,
            policy: policy_str,
            signature: signature,
            'Content-Type': '$Content-Type',
            success_action_status: '201'
        };
        $("#asset-uploader").data('current_dir', dir);
        asset_uploader.setOption('multipart_params', post);
        asset_uploader.splice(0, asset_uploader.files.length);
    }
    $pubDlg.find('.fileinput').each(function()
         {
             var $this = $(this);
             this._s3Upload = s3UploadInit($this, {
                 s3: awsS3,
                 type: $this.find('input[type=file]').data('type') || 'file',
                 Bucket: config.s3Bucket,
                 Key: function()
                 {
                     var title = $pubDlg.find('input[name=FolderName]').val(),
                     vars = getObjectOfForm($pubDlg),
                     file = $(this).attr('name');
                     
                     for(var i in vars)
                         file = file.replace('*'+i+'*', vars[i]);
                     file.replace('\\*', '*');
                     return s3AuthObj.rootDirectory + '/' + 
                         appName + '/' + title + '/' + file;
                 },
                 signExpires: function()
                 {
                     return awsExpireReverse(config.awsExpireReverseInHours);
                 },
                 onerror: handleAWSS3Error,
                 loadnow: false
             });
         });
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
    $pubDlg.find('.set-title-btn').click(function()
         {
             var $title_inp = $pubDlg.find('input[name=FolderName]'),
             title_val = $title_inp.val();
             if(!title_val)
                 return false;
             $(this).parent().hide();
             $title_inp.prop('disabled', true);
             $pubDlg.find('.pub-body-form').show();
             setPLUploadInfoForPub(title_val);
             return false;
         });
    $pubDlg.on('show.bs.modal', function()
         {
             pubDlgUpdated = false;
             var pub = $pubDlg.data('pubObj'),
             type = 'Free';
             if(pub)
             {
                 $pubDlg.find('.set-title-btn').parent().hide();
                 $pubDlg.find('input[name=FolderName]').prop('disabled', true);
                 $pubDlg.find('.pub-body-form').show();
                 $pubDlg.find('.fileinput').each(function()
                    {
                        if(this._s3Upload)
                            this._s3Upload.reload();
                    });
                 setPLUploadInfoForPub(pub.FolderName);
             }
             else
             {
                 $pubDlg.find('input[name=FolderName]').prop('disabled', false);
                 $pubDlg.find('.set-title-btn').parent().show();
                 $pubDlg.find('.pub-body-form').hide();
             }
             $pubDlg.find('input[name=Type]').each(function()
                 {
                     if(this.value == type)
                         this.checked = true;
                     else
                         this.checked = false;
                 });
             pubDlgUpdateType();
         });
    $pubDlg.find('.action-btn').click(function()
         {
             var pub = $pubDlg.data('pubObj'),
             $this = $(this);
             if($this.data('isLoading'))
                 return false;
             $this.ladda({}).ladda('start').data('isLoading', true);
             
             var magazines_key = s3AuthObj.rootDirectory + '/' +
                 appName + '/Magazines.plist';
             awsS3.getObject({
                 Bucket: config.s3Bucket,
                 Key: magazines_key
             }, function(err, res)
                {
                    var list;
                    if(err && err.code != 'NoSuchKey')
                    {
                        $this.ladda('stop').data('isLoading', false);
                        handleAWSS3Error(err);
                        return;
                    }
                    else if(err)
                        list = [];
                    else
                    {
                        try {
                            var xml = $.parseXML(res.Body.toString());
                            list = xml ? $.plist(xml) : [];
                        }catch(e) {
                            list = [];
                        }
                    }
                    var pub_info = getObjectOfForm($pubDlg[0]);
                    if(!insertPubInList(pub_info, list) && !pub)
                    {
                        $this.ladda('stop').data('isLoading', false);
                        notifyUserError('Folder is already exists!');
                        return;
                    }
                    

                    var body = $.plist('toString', list);
                    
                    awsS3.putObject({
                        Bucket: config.s3Bucket,
                        Key: magazines_key,
                        Body: body
                    }, function(err)
                       {
                           $this.ladda('stop').data('isLoading', false);
                           if(err)
                               return handleAWSS3Error(err);
                           pubDlgUpdated = true;
                           if(pub)
                               alert('Publication is updated successfully!');
                           else
                               alert('Publication is created successfully!');
                       });
                });

             
             /*
             
             ad = ad || {
                 Title: $adDlg.find('input[name=FolderName]').val()
             };
             saveAdPlist(appName, ad, function(err)
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
             */
             return false;
         });
    $pubDlg.find('input[name=Type]').on('change', pubDlgUpdateType);
    function pubDlgUpdateType()
    {
        var paid_item = $pubDlg.find('.paid-upload-item'),
        paid_radio = $pubDlg.find('input[name=Type]').filter('[value=Paid]');
        if(paid_radio.prop('checked'))
            paid_item.show();
        else
            paid_item.hide();
    }

    if (s3AuthObj && awsS3) {

        s3ListAllObjects(awsS3, {
                Bucket: config.s3Bucket,
                Prefix: s3AuthObj.rootDirectory + '/'+appName+'/',
                Delimiter: '/'
            },
            function(error, apps) {

                awsS3.getObject({
                    Bucket: config.s3Bucket,
                    Key: s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist'
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
                            FolderName: isolateFolderName(appsList[i].Prefix),
                            Title: "",
                            Subtitle: "",
                            status: "inactive",
                            statusBtn: "<a data-filename='" + isolateFolderName(appsList[i].Prefix) + "' class='btn  btn-danger btn-xs text-center btnActive' href='#'>Inactive</a>",
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

                            if (isolateFolderName2(activeList[j].FolderName) == temp[count].FolderName ||
                                isolateFolderName3(activeList[j].FolderName) == temp[count].FolderName) {
                                temp[count].Title = activeList[j].Title;
                                temp[count].Subtitle = activeList[j].Subtitle;
                                temp[count].status = "active";
                                temp[count].statusBtn = "<a data-filename='" + isolateFolderName(appsList[i].Prefix) + "' data-id='" + j + "' class='btn  btn-success btn-xs text-center btnInactive' href='#'>Active</a>";
                                temp[count].id = j;
                                added = true;
                                break;
                            }
                        }

                        rowsList.push(temp[count]);
                        count++;
                    }
                    for(var i = 0, l = activeList.length; i < l; ++i)
                    {
                        var temp = $.extend(true, {}, activeList[i]);
                        temp.status = temp.Status ? "active" : "inactive";
                        temp.statusBtn =  temp.Status ? "<a data-filename='" + temp.FolderName + "' data-id='" + i + "' class='btn  btn-success btn-xs text-center btnInactive' href='#'>Active</a>" : "<a data-filename='" + temp.FolderName + "' class='btn  btn-danger btn-xs text-center btnActive' href='#'>Inactive</a>";
                        temp.id = i;
                        
                        insertPubInList(temp, rowsList);
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
                    function pubTRClick()
                    {
                        var $this = $(this),
                        item = getPubByRowId(this.id);
                        if(!item)
                            return;
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

                    activeInactiveEvents(publicationsTable);
                    
                    $pubTable.on('click', 'tbody > tr', pubTRClick)
                });
            });
    }
    function insertPubInList(pub, list)
    {
        var pubfn = pub.FolderName,
        replaced;
        // replace publications or add it
        for(var i = 0, l = list.length; i < l; ++i)
        {
            var item = list[i];
            if(item && item.FolderName == pubfn)
            {
                list[i] = pub;
                replaced = true;
                break;
            }
        }
        if(!replaced)
        {
            list.push(pub);
            return true;
        }
    }
});

function formDisplay() {
    $("input[name='folderName']").bind("keyup", function() {
        $(".hiddenFields").show();
    });
}

function activeInactiveEvents(publicationsTable) {

    $("a.btnActive").bind("click", function(e) {
        e.preventDefault();
        var obj = $(this);
        activePublication(obj, publicationsTable);
    });

    $("a.btnInactive").bind("click", function(e) {
        e.preventDefault();
        var obj = $(this);
        inactivePublication(obj, publicationsTable);
    });
}

function activePublication(obj, publicationsTable) {
    var some_html = '<form class="form-horizontal"> <div class="form-group"> ' +
        '<label class="control-label col-lg-4">Title</label> ' +
        '<div class="col-lg-8"> ' +
        '<input type="text" name="pubTitleInput" /> ' +
        '</div> ' +
        '</div>';
    some_html += '<div class="form-group"> ' +
        '<label class="control-label col-lg-4">Subtitle</label> ' +
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
    var appName = storage.getItem(config.storageAppNameKey);

    var pTitle = $("input[name='pubTitleInput']").val();
    var pSubtitle = $("input[name='pubSubtitleInput']").val();

    awsS3.getObject({
        Bucket: window.config.s3Bucket,
        Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist'
    }, function(err, activated) {

        //var activeList = PlistParser.parse($.parseXML(activated.Body.toString()));
        var activeList = $.plist($.parseXML(activated.Body.toString()));
        var activeListLength = $.map(activeList, function(n, i) { return i; }).length;

        activeList[activeListLength] = {
            FolderName: obj.data("filename") + "/" + obj.data("filename") + "_.pdf",
            Title: pTitle,
            Subtitle: pSubtitle
        };

        var params = {
            Bucket: window.config.s3Bucket, // required
            Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist',
            //Body: PlistParser.toPlist(activeList)
            Body: cleanKeys($.plist('toString', activeList))
        };
        window.awsS3.putObject(params, function(err, data) {
            if (err) {
                alert(Error);
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
    var appName = storage.getItem(config.storageAppNameKey);

    awsS3.getObject({
        Bucket: window.config.s3Bucket,
        Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist'
    }, function(err, activated) {

        //var activeList = PlistParser.parse($.parseXML(activated.Body.toString()));
        var activeList = $.plist($.parseXML(activated.Body.toString()));

        var id = obj.data("id");

        delete activeList[id];

        activeList = deleteFromObject(activeList, undefined);

        //var rowIndex = publicationsTable.fnGetPosition( obj.closest('tr')[0] );
        //publicationsTable.fnDeleteRow(rowIndex);

        var params = {
            Bucket: window.config.s3Bucket, // required
            Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist',
            //Body: PlistParser.toPlist(activeList)
            Body: cleanKeys($.plist('toString', activeList))
        };
        window.awsS3.putObject(params, function(err, data) {
            if (err) {
                alert(Error);
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
        '0': data.FolderName,
        '1': "<span class='ttitle'>" + data.Title + "</span>",
        '2': "<span class='tsubtitle'>" + data.Subtitle + "</span>",
        '3': data.statusBtn
    });
}

function isolateFolderName(name) {
    return name.replace(s3AuthObj.rootDirectory + '/' + storage.getItem(config.storageAppNameKey) + '/', "").replace("/", "");
}

function isolateFolderName2(name) {
    return name.substring(	name.indexOf("/")+1, name.length-5);
}

function isolateFolderName3(name) {
    return name.substring(	name.indexOf("/")+1, name.length-4);
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
