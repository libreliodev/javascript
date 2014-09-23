var arraySlice = Array.prototype.slice;
function notifyError(err)
{
  alert(err);
}
function parse_url(url)
{
  return $('<a/>').prop('href', url)[0].href;
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
  if(auth)
  {
    purchase_dialog_submit($.extend({}, opts, auth), function(success)
      {
        if(!success)
        {
          localStorage.setItem('reader-auth', null)
          setup(type);
        }
      });
  }
  else
    setup(type);
  function setup(type)
  {
    purchase_dialog_set_page(type);
    dlg.find('input').val('');
    dlg.data('pdata', opts)
      .modal('show');
    dlg.find('.login-result').hide();
    $('#purchase-dlg-submit').show();
  }
  
}
function purchase_dialog_set_page(page)
{
  $('#purchase-dialog')
    .toggleClass('purchase-dialog-user-service', page == 'user')
    .toggleClass('purchase-dialog-code-service', page == 'code')
    .toggleClass('purchase-dialog-result', page == 'result');
  if(page == 'result') // hide submit btn in result page 
    $('#purchase-dlg-submit').hide();
}
function purchase_dialog_submit(opts, cb)
{
  cb = cb || opts.submit_callback;
  // make a request
  var dlg = $('#purchase-dialog'),
  url_str,
  query = {
    client: opts.client,
    app: opts.app, 
    service: opts.service,
    urlstring: opts.urlstring || '',
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
  dlg.find('.login-result').hide();
  function show_login_result(err)
  {
    var $res_div = dlg.find('.login-result').show();
    $res_div.find('.login-success')[!err ? 'show' : 'hide']();
    var $login_failed = $res_div.find('.login-failed')[err ? 'show' : 'hide']();
    if(err)
    {
      var failed_text = $login_failed.data('text');
      if(!failed_text)
      {
        failed_text = $login_failed.text();
        $login_failed.data('text', failed_text);
      }
      $login_failed.text(sprintf(failed_text, err));
    }
    else
      purchase_dialog_set_page('result');
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
        show_login_result($err.find('Message').text());
        cb && cb(false);
      }
      else if($url.length > 0)
      {
        var url_str = $url.text(),
        auth_obj = { type: opts.type };
        if(opts.type == 'user')
        {
          auth_obj.user = query.user;
          auth_obj.pswd = query.pswd;
        }
        else if(opts.type == 'code')
          auth_obj.code = query.code;
         localStorage.setItem('reader-auth', JSON.stringify(auth_obj));
        if(!opts.urlstring)
          show_login_result();
        else
        {
          var path_str = url_path_plus(url_str),
          prefix = opts.client + '/' + opts.app + '/',
          pidx = path_str.indexOf(prefix);
          if(pidx > -1 && ((pidx == 1 && path_str[0] == '/') || pidx === 0 ))
            path_str = path_str.substr(pidx + prefix.length);
          document.location = 'pdfreader.html?waurl=' + 
            encodeURIComponent('/' + path_str);
        }
        cb && cb(true);
      }
      else
      {
        cb && cb(false);
        var err = _("Unknown response!");
        show_login_result(err);
      }
    },
    error: function(xhr, err_text)
    {
      cb && cb(false);
      var err = sprintf(_("Request has failed: %s"), err_text);
      show_login_result(err);
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
          if($(this).val())
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

function magazine_name_free2paid(fn, noext)
{
  var ext = path.extname(fn),
  bn = path.join(path.dirname(fn), path.basename(fn, ext));
  return bn + '_'  + (noext ? '' : ext);
}

function application_info_load(opts, cb)
{
  opts = opts || {};
  var app_url;
  if(opts.wapublisher && opts.waapp)
    app_info_url = s3bucket_file_url(opts.wapublisher + '/' + opts.waapp + 
                                    '/APP_/Uploads/setup.plist');
  else
    app_info_url = 'reader_.plist';
  $.ajax(app_info_url, {
    success: function(data)
    {
      var data_obj,
      err;
      try {
        data_obj = $.plist($.parseXML(data));
        if(!data_obj.Active)
          err = _("This App Does Not Exist");
        data_obj.Publisher = data_obj.Publisher || opts.wapublisher;
        data_obj.Application = data_obj.Application || opts.waapp;
      } catch(e) {
        err = e+'';
      }
      cb(err, data_obj);
    },
    error: function(xhr, err, err_text)
    {
      cb(sprintf(_("Couldn't load `%s`: %s"), app_info_url,
                 err_text));
    }
  });
}
function reader_url_eval(url_str, external_b, app_data)
{
  // url_str is special formed path
  // if it has leading slash it's a file from application storage
  // otherwise treat it as it's a external link
  if(!external_b && url_str[0] == '/')
    url_str = s3bucket_file_url(app_data.Publisher + '/' + 
                                app_data.Application + url_str);
  return url_str;
}
function initialize_reader(cb, cb2)
{
  var doc_query = querystring.parse(get_url_query(document.location+'')),
  url_str = doc_query ? doc_query.waurl : null,
  external_b = doc_query ? typeof doc_query.external != 'undefined' : null,
  url_str_dir;

  $(function(){
    cb2 && cb && cb();
    application_info_load(doc_query, function(err, data)
      {
        if(err)
          return notifyError(err);
        if(url_str)
        {
          url_str = reader_url_eval(url_str, external_b, data);
          url_str_dir = url_dir(url_str);
        }
        cb = cb2 ? cb2 : cb;
        cb(data, url_str, url_str_dir, external_b, doc_query);
      });
  });
}
