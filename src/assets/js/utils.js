(function(root){

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
    return function(p)
    {
        return typeof p == 'function' ? p.apply(call_this, call_args) : p;
    }
}
function S3LoadImageupload($image_upload, opts)
{
    var eval_opts_prop = _eval_opts_prop_maker(this, [$image_upload, opts])
    $inp = $image_upload.find('input[type=file]');
    var url = awsS3.getSignedUrl('getObject', {
        Bucket: opts.Bucket,
        Key: opts.Key ? eval_opts_prop(opts.Key) : 
            eval_opts_prop(opts.Prefix) + $inp.attr('name'),
        Expires: opts.signExpires ? eval_opts_prop(opts.signExpires) : 900
    });
    var $img = $('<img/>');
    $image_upload.removeClass('fileinput-new')
        .toggleClass('fileinput-exists', true);
    $img.prop('src', url)
        .bind('error', function()
          {
              $image_upload.toggleClass('fileinput-new', true)
                  .removeClass('fileinput-exists');
              $img.remove();
          });
    $image_upload.find('.fileinput-preview').empty().append($img);
    
}
root.s3ImageuploadInit = function($image_upload, opts)
{
    var eval_opts_prop = _eval_opts_prop_maker(this, [$image_upload, opts])
    opts = opts || {};
    if(typeof opts.loadnow === 'undefined' || opts.loadnow)
        S3LoadImageupload($image_upload, opts);
    $image_upload.find('input[type=file]').bind('change', function()
      {
          var $this = $(this),
          file = this.files ? this.files[0] : null;
          if(file)
          {
              $this.prop('disabled', true);
              var $new_btn = $image_upload.find('.fileinput-new'),
              $change_btn = $image_upload.find('.fileinput-change'),
              image_name = $this.attr('name'),
              new_v = $new_btn.text(),
              change_v = $change_btn.text();
              $new_btn.text('Uploading...');
              $change_btn.text('Uploading...');
              
              var request = awsS3.putObject({
                  Bucket: opts.Bucket,
                  Key: opts.Key ? eval_opts_prop(opts.Key) : 
                      eval_opts_prop(opts.Prefix) + image_name,
                  Body: file,
                  ContentType: file.type
              }, function(err, res)
                 {
                     if(err)
                     {
                         typeof opts.onerror == 'function' && opts.onerror(err);
                         return;
                     }
                     
                     $new_btn.text(new_v);
                     $change_btn.text(change_v);
                     $this.prop('disabled', false);
                 });
              var httpRequest = request.httpRequest.stream;
              if(httpRequest.upload)
                  $(httpRequest.upload).on('progress', function(ev)
                      {
                          ev = ev.originalEvent;
                          var complete = ev.loaded / ev.total,
                          upload_str = 'Uploading... ' + 
                              Math.floor(complete * 100) + '%';
                          
                          $new_btn.text(upload_str);
                          $change_btn.text(upload_str);
                      });
          }
      });
    return {
        reload: function()
        {
            S3LoadImageupload($image_upload, opts);
        }
    };
}

root.awsExpireReverse = function(s)
{
    var now = new Date();
    now = Math.floor(now.getTime() / 1000) - 
        now.getTimezoneOffset() * 60;
    s = s * 3600;
    return s - (now % s);
}

})(window);
