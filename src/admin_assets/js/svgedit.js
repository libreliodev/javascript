(function(window){

    var doc_query = path.urlParseQuery(document.location),
    app_name = doc_query.app || storage.getItem(config.storageAppNameKey),
    app_dir = s3AuthObj.rootDirectory + '/' + app_name +
        (s3AuthObj.type == 'idFed' ? '/' + s3AuthObj.userDirname : '');
    $(function()
       {
           // load requested svg if exists
           var filename = doc_query.filename;
           if(!filename)
               alert(_('No file is select to edit!'));
           $.open_dialog(_('Please wait..'), {})
           loadSVGFileFromApp(filename, function(err)
              {
                  if(err && err.code != 'NoSuchKey')
                      alert(err);
                  $.main_dialog_hide();
              });
       });

    function loadSVGFileFromApp(filename, cb)
    {
        awsS3.getObject({
            Bucket: config.s3Bucket,
            Key: app_dir + '/' + filename
        }, function(err, res)
           {
               if(err)
                   return cb && cb(err);
               svgEditor.loadFromString(res.Body.toString());
               svgEditor.canvas.undoMgr.resetUndoStack();
               cb && cb();
           });
    }

    // edit behavior of open image
    function getPubType(pub, cb)
    {
        s3ObjectExists(awsS3, {
            Bucket: config.s3Bucket,
            Key: app_dir + '/' + pub + '/' + pub + '_.svg'
        }, function(err, exists)
           {
               if(err)
                   return cb && cb(err);
               cb && cb(null, exists ? 'Paid' : 'Free');
           });
    }
    function openSVGFromApp(key)
    {
        document.location = 'svgedit.html?' + path.stringifyQuery({
            app: app_name,
            filename: key
        });
    }
    function openSelectPubTypeDialog(pub)
    {
        function addType(type)
        {
            $('<li>').append($('<a>').attr('href', '#').text(type)
                        .click(function()
                   {
                       switch(type)
                       {
                       case 'Paid':
                           openSVGFromApp(pub + '/' + pub + '_.svg');
                           break;
                       case 'Free':
                           openSVGFromApp(pub + '/' + pub + '.svg');
                           break;
                       }
                   })).appendTo($ul);

        }
        var $wrp = $('<div>'),
        $title = $('<h3>').html('Select Publication\'s Type'),
        $ul = $('<ul>').addClass('pub-types-list'),
        types = [ 'Free', 'Paid' ];
        $wrp.append($title)
            .append($ul);
        for(var i = 0, l = types.length; i < l; ++i)
            addType(types[i]);
        $.open_dialog($wrp, {
            Cancel: function()
            {
                $.main_dialog_hide();
            }
        });
    }
    // override open method
    svgEditor.setCustomHandlers({
        open: function()
        {
            var $wrp = $('<div>'),
            $title = $('<h3>').html('Open Publications SVG'),
            $ul = $('<ul>').addClass('pubs-list');
            $wrp.append($title)
                .append($ul);
            $.open_dialog($wrp, {
                Cancel: function()
                {
                    $.main_dialog_hide();
                }
            });
            
            listPublications(awsS3, {
                Bucket: config.s3Bucket,
                Prefix: app_dir
            }, function(err, pubs)
               {
                   if(err)
                       return alert(err);
                   function addPub(pub)
                   {
                       $('<li>').addClass('pub-item')
                           .append($('<a>').attr('href', '#').text(pub)
                                   .click(function()
                             {
                                 getPubType(pub, function(err, type)
                                  {
                                      if(err)
                                          return alert(err);
                                      $.main_dialog_hide();
                                      if(type == 'Paid')
                                          openSelectPubTypeDialog(pub);
                                      else
                                          openSVGFromApp(pub + '/' + pub +
                                                        '.svg');
                                  });
                                 return false;
                             })).appendTo($ul);
                   }
                   for(var i = 0, l = pubs.length; i < l; ++i)
                       addPub(pubs[i]);
               });
        },
        save: function(opts)
        {
           var filename = doc_query.filename;
           if(!filename)
               alert('No file is select to save!');
           $.open_dialog('Please wait..', {})
           awsS3.putObject({
               Bucket: config.s3Bucket,
               Key: app_dir + '/' + filename,
               Body: svgEditor.canvas.getSvgString()
           }, function(err)
              {
                  if(err)
                      alert(err);
                  $.main_dialog_hide();
                  svgEditor.curConfig.no_save_warning = true;
              });
        }
    });
    svgEditor.addExtension("openSVGFromApp", function(methods) {
        return {
            elementChanged: function()
            {
                svgEditor.curConfig.no_save_warning = false;
            },
            addlangData: function()
            {
                return {
                    tools: {
                        open_doc: _('Open'),
                        save_doc: _('Save'),
                        import_doc: _('Import')
                    }
                };
            }
        };
    });

})(window);
