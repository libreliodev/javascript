function librelio_pdf_resolve_url(s, relto)
{
  function relpath(s)
  {
    var query = url('?', s),
    hash = url('#'),
    path = url('path', s);
    return (path[0] == '/' ? path.substr(1) : path) +
      (query ? '?' + query : '') + (hash ? '#' + hash : '');
  }
  var hostname = url('hostname', s);
  if(hostname == 'localhost' || !hostname)
    return (relto ? relto + '/' : '') + relpath(s);
  return s;
}
function url_protocol(s)
{
  var pttrn = /^(\w+:)\/\//,
  match = pttrn.exec(s);
  return match ? match[1] : (s.substr(0, 2) == '//' ? '' : null);
}
function url_till_hostname(s)
{
  var proto = url_protocol(s),
  hostname = url('hostname', s),
  auth = url('auth', s);
  if(proto === null)
    return '';
  else
    return proto + '//' + (auth ? auth + '@' : '') + url('hostname', s);
}
function url_dir(s)
{
  var url_str = url_till_hostname(s),
  dirname = path.dirname(url_str === '' ? s : url('path', s));
  return url_str + (dirname[0] == '/' ? '' : '/') + dirname;
}
function url_path_plus(url_str)
{
  var query_str = url('?', url_str),
  hash_str = url('#', url_str);
  return url('path', url_str) + (query_str ? '?' + query_str : '') + 
    (hash_str ? '#' + hash_str : '');
}
function get_url_query(url)
{
  var idx = url.indexOf('?'),
  idx2 = url.indexOf('#');
  return idx == -1 ? '' : 
    (idx2 == -1 ? url.substr(idx + 1) : url.substring(idx + 1, idx2));
}
function wrpFunc(func, thisarg, prepend_args, append_args)
{
  var arraySlice = Array.prototype.slice;
  return function()
  {
    var args = arraySlice.call(arguments);
    return func.apply(thisarg || this, 
                 prepend_args ? prepend_args.concat(args, append_args) :
                                args.concat(append_bargs));
  }
}
function funcListCall(a)
{
  for(var i = 0, l = a.length; i < l; ++i)
  {
    var item = a[i];
    item[1].apply(item[0], item.slice(2));
  }
}
function on(el, releaser)
{
  var arraySlice = Array.prototype.slice;
  el.on.apply(el, arraySlice.call(arguments, 2));
  if(releaser)
    releaser.push(([ el, el.off ]).concat(arraySlice.call(arguments, 2)));
  return wrpFunc(arguments.callee, null, [ el, releaser ]);
}
