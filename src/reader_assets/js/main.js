var arraySlice = Array.prototype.slice;
function notifyError(err)
{
  alert(err);
}
function wrpFunc(func, thisarg, prepend_args, append_args)
{
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
  el.on.apply(el, arraySlice.call(arguments, 2));
  if(releaser)
    releaser.push(([ el, el.off ]).concat(arraySlice.call(arguments, 2)));
  return wrpFunc(arguments.callee, null, [ el, releaser ]);
}

function parse_url(url)
{
  return $('<a/>').prop('href', url)[0].href;
}
function get_url_query(url)
{
  var idx = url.indexOf('?'),
  idx2 = url.indexOf('#');
  return idx == -1 ? '' : 
    (idx2 == -1 ? url.substr(idx + 1) : url.substring(idx + 1, idx2));
}

function purchase_dialog_open(opts)
{
  var type = opts.type,
  dlg = $('#purchase-dialog'),
  auth;
  if(dlg.length === 0)
    return;
  try {
    auth = JSON.parse(localStorage.getItem('reader-auth'));
  }catch(e) {
  }
  $('#purchase-dlg-submit').css('display', '');
  if(auth && type == 'user')
  {
    purchase_dialog_submit($.extend({}, opts, auth), function(success)
      {
        if(success)
          setup();
        else
          setup(type);
      });
  }
  else
    setup(type);
  function setup(type)
  {
    if(type)
    {
      purchase_dialog_set_page(type);
      dlg.find('input').val('');
    }
    dlg.data('pdata', opts)
      .modal('show');
  }
  
}
function purchase_dialog_set_page(page)
{
  $('#purchase-dialog')
    .toggleClass('purchase-dialog-user-service', page == 'user')
    .toggleClass('purchase-dialog-code-service', page == 'code')
    .toggleClass('purchase-dialog-result', page == 'result');
}
function purchase_dialog_submit(opts, cb)
{
  // make a request
  var dlg = $('#purchase-dialog'),
  url_str,
  query = {
    client: opts.client,
    app: opts.app, 
    service: opts.service,
    urlstring: opts.urlstring,
    deviceid: new Fingerprint().get(),
    header: '200'
  };
  switch(opts.type)
  {
  case 'user':
    if(typeof opts.user != 'undefined')
    {
      query.user = opts.user;
      query.pswd = opts.pswd;
    }
    else
    {
      query.user =  $('#purchase-dlg-user-inp').val();
      query.pswd = $('#purchase-dlg-pass-inp').val();
    }
    url_str = 'http://download.librelio.com/downloads/subscribers.php?' +
      querystring.stringify(query);
    break;
  case 'code':
    if(typeof opts.code != 'undefined')
      query.code = opts.code;
    else
      query.code = $('#purchase-dlg-code-inp').val();
    url_str = 'http://download.librelio.com/downloads/pswd.php?' +
      querystring.stringify(query);
    break;
  default:
    return;
  }
  $.ajax(url_str, {
    dataType: 'xml',
    success: function(xmlDoc)
    {
      var $xmlDoc = $(xmlDoc),
      $err = $xmlDoc.find('Error'),
      $url = $xmlDoc.find('UrlString');
      if($err.length > 0)
      {
        notifyError($err.find('Message').text());
        cb && cb(false);
      }
      else if($url.length > 0)
      {
        var url_str = $url.text();
        purchase_dialog_set_page('result');
        $('#purchase-dlg-submit').css('display', 'none');
        dlg.find('.result-pdfreader-url')
          .attr('href', 'pdfreader.html?waurl=' + 
                encodeURIComponent(url_path_plus(url_str)));
        dlg.find('result-download-url').attr('href', url_str);
        if(opts.type == 'user')
          localStorage.setItem('reader-auth', JSON.stringify({
            user: query.user,
            pswd: query.pswd
          }));
        cb && cb(true);
      }
      else
      {
        cb && cb(false);
        notifyError("Unknown response!");
      }
    },
    error: function(xhr, err_text)
    {
      cb && cb(false);
      notifyError("Failed to request for page: " + err_text);
    }
  });
}
$(function()
  {
    $('#purchase-dlg-submit').click(function()
      {
        // make a request
        var dlg = $('#purchase-dialog'),
        opts = dlg.data('pdata');
        if(opts)
          purchase_dialog_submit(opts);
        return false;
      });
    $('#purchase-dlg-pass-inp,#purchase-dlg-code-inp')
      .on('keypress', function(ev)
      {
        if(ev.which == 13)
        {
          $('#purchase-dlg-submit').click();
          return false;
        }
      });
    $('#purchase-dlg-cancel').click(function()
      {
        $('#purchase-dialog').modal('hide')
          .find('input').val('');
        return false;
      });
  });
function librelio_resolve_url(s, relto)
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
function url_till_hostname(s)
{
  var proto = url('protocol', s),
  auth = url('auth', s);
  return (proto ? proto + '://' : (hostname ? '//' : '')) +
    (auth ? auth + '@' : '') + (url('hostname', s) || '');
}
function url_dir(s)
{
  var dirname = path.dirname(url('path', s));
  return url_till_hostname(s) + (dirname[0] == '/' ? '' : '/') + dirname;
}
function url_path_plus(url_str)
{
  var query_str = url('?', url_str),
  hash_str = url('#', url_str);
  return url('path', url_str) + (query_str ? '?' + query_str : '') + 
    (hash_str ? '#' + hash_str : '');
}
function s3bucket_file_url(key)
{
  return '//' + config.s3Bucket + '.s3.amazonaws.com' + 
    (key[0] == '/' ? '' : '/') + key;
}

function magazine_name_free2paid(fn, noext)
{
  var ext = path.extname(fn),
  bn = path.join(path.dirname(fn), path.basename(fn, ext));
  return bn + '_'  + (noext ? '' : ext);
}
