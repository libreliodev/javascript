
function s3ListAllObjects(s3, opts, cb, marker)
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
