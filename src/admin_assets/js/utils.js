(function(root){

var illegalPubs = [ "AAD", "APP__", "APP_", "APP_", "APW_" ];
root.listPublications = function(s3, opts, cb)
{
    s3ListDirectories(s3, opts, function(err, pubs)
       {
           if(err)
               return cb && cb(err);
           for(var i = 0; i < pubs.length;)
               if(illegalPubs.indexOf(pubs[i]) >= 0)
                   pubs.splice(i, 1);
               else
                   i++;
           cb && cb(err, pubs);
       });
}

// lists directories within another directory
root.s3ListDirectories = function(awsS3, opts, cb)
{
    opts = $.extend(true, {}, opts);
    opts.Delimiter = '/';
    var prefix = opts.Prefix || '/';
    opts.Prefix = prefix + (prefix[prefix.length - 1] != '/' ? '/' : '')
    prefix = opts.Prefix;
    s3ListAllObjects(awsS3, opts, function(err, res)
      {
          var dirs;
          if(!err && res.CommonPrefixes)
          {
              var prefixes = res.CommonPrefixes,
              pttrn = /[^\/]+/;
              dirs = [];
              for(var i = 0, l = prefixes.length; i < l; ++i)
              {
                  var m = pttrn.exec(prefixes[i].Prefix.substr(prefix.length));
                  if(m && m[0])
                      dirs.push(m[0]);
              }
          }
          cb.call(this, err, dirs);
      });
}
root.s3ListAllObjects = function(s3, opts, cb, marker)
{
    opts_cpy = $.extend(true, {}, opts);
    opts_cpy.Marker = marker || '';
    s3.listObjects(opts_cpy, function(err, res)
       {
           if(err)
               return cb && cb(err);
           var r = res.Contents,
           nextMarker = res.NextMarker ? res.NextMarker : 
               (r.length > 0 ? r[r.length - 1].Key : '');
           if(res.IsTruncated && nextMarker)
           {
               s3ListAllObjects(s3, opts, function(err, res2)
                   {
                       if(err)
                           return cb && cb(err);
                       res.Contents = res.Contents.concat(res2.Contents);
                       res.CommonPrefixes = res.CommonPrefixes.concat(res2.CommonPrefixes);
                       res.IsTruncated = false;
                       cb(undefined, res);
                   }, nextMarker);
           }
           else
               cb(undefined, res);
       });
}


var illegal_class_chars_pttrn = /#.\(\)/g;
root.encodeStringToClassName = function(s)
{
    return s.replace(illegal_class_chars_pttrn, '_');
}

// this method makes eval_opts_prop
function _eval_opts_prop_maker(call_this, call_args)
{
    return function(p, ea)
    {
        return typeof p == 'function' ? p.apply(call_this, 
                                                (ea||[]).concat(call_args)) : p;
    }
}
function S3LoadUpload($upload, opts)
{
    var input = $upload.find('input[type=file]')[0],
    eval_opts_prop = _eval_opts_prop_maker(input, [$upload, opts]),
    $inp = $upload.find('input[type=file]');
    switch(opts.type)
    {
    case 'Image':
        opts.s3.getSignedUrl('getObject', {
            Bucket: opts.Bucket,
            Key: opts.Key ? eval_opts_prop(opts.Key,['checkexists']) : 
                eval_opts_prop(opts.Prefix,['checkexists']) + $inp.attr('name'),
            Expires: opts.signExpires ? eval_opts_prop(opts.signExpires) : 900
        }, function(err, url)
           {
               if(err)
               {
                   $inp.data('exists', false);
                   typeof opts.onFileExistCheck == 'function'  && 
                       opts.onFileExistCheck.call($inp[0], true);
                   return;
               }
               var $img = $('<img/>');
               $upload.removeClass('fileinput-new')
                   .toggleClass('fileinput-exists', true);
               $inp.data('exists', true);
               $img.prop('src', url)
                   .bind('error', function()
                   {
                       $inp.data('exists', false);
                       $upload.toggleClass('fileinput-new', true)
                           .removeClass('fileinput-exists');
                       $img.remove();
                       typeof opts.onFileExistCheck == 'function'  && 
                           opts.onFileExistCheck.call($inp[0], false);
                   })
                   .bind('load', function()
                   {
                       typeof opts.onFileExistCheck == 'function'  && 
                           opts.onFileExistCheck.call($inp[0], true);
                   });
               $upload.find('.fileinput-preview').empty().append($img);
           });
        break;
    default:
        s3ObjectExists(opts.s3, {
            Bucket: opts.Bucket,
            Key: opts.Key ? eval_opts_prop(opts.Key,['checkexists']) : 
                eval_opts_prop(opts.Prefix,['checkexists']) + $inp.attr('name')
        }, function(err, file_exists)
           {
               file_exists = !!file_exists;
               $upload.toggleClass('fileinput-new', !file_exists)
                   .toggleClass('fileinput-exists', file_exists);
               $inp.data('exists', file_exists);
               typeof opts.onFileExistCheck == 'function'  && 
                   opts.onFileExistCheck.call($inp[0], file_exists);
           });
        break;
    }
}
root.s3UploadInit = function($upload, opts)
{
    var input = $upload.find('input[type=file]')[0],
    eval_opts_prop = _eval_opts_prop_maker(input, [$upload, opts]),
    isUploading,
    $inp = $upload.find('input[type=file]');
    if(typeof opts.loadnow === 'undefined' || opts.loadnow)
        S3LoadUpload($upload, opts);
    function removeFile(cb)
    {
        var inp_name = $inp.attr('name'),
        $new_btn = $upload.find('.fileinput-new'),
        $remove_btn = $upload.find('.fileinput-remove'),
        $preview = $upload.find('.fileinput-preview'),
        new_v = $new_btn.html(),
        remove_v = $remove_btn.html(),
        preview_v = $preview.html();
        
        $new_btn.text('Removing...');
        $remove_btn.text('Removing...');
        
        opts.s3.deleteObject({
            Bucket: opts.Bucket,
            Key: opts.Key ? eval_opts_prop(opts.Key,['delete']) : 
                eval_opts_prop(opts.Prefix,['delete']) + image_name
        }, function(err)
           {
               $new_btn.html(new_v);
               $remove_btn.html(remove_v);
               if(err)
               {
                   $preview.html(preview_v);
                   $upload.toggleClass('fileinput-new', false)
                       .toggleClass('fileinput-exists', true);
                   typeof opts.onerror == 'function' && 
                       opts.onerror.call($inp[0], err);
               }
               else
               {
                   $inp.attr('name', inp_name);
                   $inp.data('exists', false);
                   typeof opts.onRemoveSuccess == 'function' && 
                       opts.onRemoveSuccess.call($inp[0]);
               }
               cb && cb(err);
           });
    }
    $inp.bind('change', function()
      {
          function setPBar(percent)
          {
              pbar_wrp.html('<div class="progress">'+
                    '<div class="progress-bar" role="progressbar" aria-valuenow="'+percent+'" aria-valuemin="0" aria-valuemax="100" style="width: '+percent+'%;">'+
                      (percent ? percent+'%' : '')+
                    '</div>'+
                  '</div>');
          }
          function operationEnd()
          {
              pbar_wrp.remove();
              $new_btn.html(new_v);
              $change_btn.html(change_v);
              $this.prop('disabled', false);
              isUploading = false;
              if(rmHandler)
                  $upload.find('.fileinput-remove').unbind('click', rmHandler);
          }
          
          var $this = $(this),
          file = this.files ? this.files[0] : null;
          if(file)
          {
              if($inp.data('exists') && opts.removeBeforeChange)
              {
                  var thismethod = arguments.callee,
                  self = this;
                  removeFile(function(err)
                      {
                          if(!err)
                              thismethod.call(self);
                      });
                  return;
              }
              $this.prop('disabled', true);
              var $new_btn = $upload.find('.fileinput-new'),
              $change_btn = $upload.find('.fileinput-change'),
              image_name = $this.attr('name'),
              new_v = $new_btn.html(),
              change_v = $change_btn.html(),
              pbar_wrp = $('<div/>').appendTo($upload)
                  .css('marginTop', 16),
              rmHandler;
              isUploading = true;
              $new_btn.text(_('Uploading...'));
              $change_btn.text(_('Uploading...'));
              setPBar(0);
              
              var request = opts.s3.putObject({
                  Bucket: opts.Bucket,
                  Key: opts.Key ? eval_opts_prop(opts.Key,['upload']) : 
                      eval_opts_prop(opts.Prefix,['upload']) + image_name,
                  Body: file,
                  ContentType: file.type
              }, function(err, res)
                 {
                     operationEnd();
                     if(err)
                     {
                         typeof opts.onerror == 'function' && 
                             opts.onerror.call($inp[0], err);
                         return;
                     }
                     $inp.data('exists', !err);
                     if(typeof opts.onUploadSuccess == 'function')
                         opts.onUploadSuccess.call($inp[0]);
                         
                 });
              $upload.find('.fileinput-remove').bind('click', 
                                                     rmHandler = function()
                 {
                     operationEnd();
                     if(httpRequest.abort)
                         httpRequest.abort();
                 });
              var httpRequest = request.httpRequest.stream;
              if(httpRequest.upload)
                  $(httpRequest.upload).on('progress', function(ev)
                      {
                          ev = ev.originalEvent;
                          var complete = ev.loaded / ev.total;
                          setPBar(Math.floor(complete * 100))
                      });
          }
      });
    $upload.find('.fileinput-remove').bind('click', function()
      {
          var $this = $(this);
          if(isUploading || $this.data('inProgress'))
              return;
          $this.data('inProgress', true);
          $inp.prop('disabled', true);
          removeFile(function()
             {
                 $this.data('inProgress', false);
                 $inp.prop('disabled', false);
                 $inp.val('');
             });
      });
    return {
        reload: function()
        {
            S3LoadUpload($upload, opts);
        }
    };
}

root.awsExpireReverse = function(s)
{
    var now = new Date();
    now = Math.floor(now.getTime() / 1000) - 
        now.getTimezoneOffset() * 60;
    s = s * 3600;
    s = s - (now % s);
    if(s < 3600)
      s == 3600;
    return s;
}

// gets input elements of forms and puts them and their values in a object
// excluding files
root.getObjectOfForm = function(el)
{
    var ret = {},
    $el = $(el);
    $el.find('input[type=text], textarea')
        .each(function()
          {
              var $this = $(this);
              ret[$this.attr('name')] = $this.data('value') ||
                  $this.val() || '';
          });
    $el.find('input[type=radio]').each(function()
          {
              if(this.checked)
                  ret[this.name] = this.value;
          });
    return ret;
}

root.s3ObjectExists = function(s3, opts, cb)
{
    opts = $.extend(true, {}, opts);
    var isKey = opts.Key && !opts.Prefix;
    opts.Prefix = opts.Key || opts.Prefix;
    delete opts.Key;
    if(!isKey)
        opts.MaxKeys = 1;
    s3.listObjects(opts, function(err, data)
        {
            if(err)
                return cb && cb(err);
            var exists;
            if(isKey)
            {
                var Contents = data.Contents;
                for(var i = 0, l = Contents.length; i < l; ++i)
                {
                    if(Contents[i].Key == opts.Prefix)
                    {
                        exists = true;
                        break;
                    }
                }
            }
            else
                exists = data && data.Contents &&
                               data.Contents.length > 0;
            cb && cb(undefined, exists);
        });
}
var filename_pttrn = /[^\/]*$/,
urlfilename_pttrn = /([^\/]*\?.*|[^\/]*)$/;
root.path = {
    filename: function(s)
    {
        var match = filename_pttrn.exec((s+'').replace("\\", "/"));
        return match ? match[0] : '';
    },
    urlFilename: function(s)
    {
        var match = urlfilename_pttrn.exec(s+'');
        return match ? match[1] : '';
    },
    urlParseQuery: function(s, sep, eq)
    {
        s = s+'';
        var idx = s.indexOf('?'),
        query = idx >= 0 && idx < s.length ? s.substr(idx+1) : '';
        return this.parseQuery(query, sep, eq);
    },
    parseQuery: function(s, sep, eq)
    {
        sep = sep || '&';
        eq = eq || '=';
        list = s.split(sep),
        res = {};
        function addElm(k, v)
        {
            k = decodeURIComponent(k);
            v = decodeURIComponent(v);
            if(typeof res[k] == 'string')
            {
                var tmp = res[k];
                res[k] = [ tmp, v ];
            }
            else if($.isArray(res[k]))
                res[k].push(v);
            else
                res[k] = v;
        }
        for(var i = 0, l = list.length; i < l; ++i)
        {
            var p = list[i].split(eq);
            if(p[0] === '')
                continue;
            if(p.length == 1)
                addElm(p[0], '');
            else // more than one elm in p
                addElm(p[0], p.slice(1).join(eq));
        }
        return res;
    },
    stringifyQuery: function(obj, sep, eq)
    {
        sep = sep || '&';
        eq = eq || '=';
        var ret = [];
        for(var i in obj)
            ret.push(encodeURIComponent(i) + eq + 
                     encodeURIComponent(obj[i]));
        return ret.join(sep);
    },
    fileExtension: function(fn)
    {
        var idx = fn.lastIndexOf('.'),
        r;
        if(idx >= 0)
            r = fn.substr(idx);
        else
            r = '';
        return r;
    }
};

root.startsWith = function(a, s, fn)
{
    if(typeof fn != 'function')
        fn = function(e) { return e; }
    var r = [];
    for(var i = 0, l = a.length; i < l; ++i)
    {
        var str = fn(a[i]),
        idx = str.indexOf(s);
        if(idx === 0)
            r.push(a[i]);
    }
    return r;
}

root.redirectToLogin = function()
{
    var query,
    path_fn = path.urlFilename(document.location);
    if(path_fn != 'index.html' && path_fn !== '')
        query = '?redirect=' + encodeURIComponent(path_fn);
    document.location = "login.html" + (query || '');
}

root.s3ModifyObjectMetadata = function(s3, opts, cb)
{
  if(!opts.Key)
    throw new Error("Option Key is required!");
  var tmp_cpy = opts.Key + '__tmp__copy__';
  s3.copyObject({
    Bucket: opts.Bucket,
    CopySource: opts.Bucket + '/' + opts.Key,
    Key: tmp_cpy
  }, function(err, res)
     {
       if(err)
         return cb && cb(err);
       s3.copyObject({
         Bucket: opts.Bucket,
         CopySource: opts.Bucket + '/' + tmp_cpy,
         Key: opts.Key,
         Metadata: opts.Metadata,
         MetadataDirective: 'REPLACE'
       }, function(err, res)
          {
            s3.deleteObject({
              Bucket: opts.Bucket,
              Key: tmp_cpy
            }, function(err2)
               {
                 if(err || err2)
                   return cb && cb(err || err2);
                 cb && cb(undefined, res);
               });
          });
     });
}

})(window);
