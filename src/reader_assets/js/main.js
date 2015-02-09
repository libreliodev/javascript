var arraySlice = Array.prototype.slice;
function notifyError(err)
{
  alert(err);
}
function parse_url(url)
{
  return $('<a/>').prop('href', url)[0].href;
}
function reader_auth_key(app_data)
{
  return 'reader-auth_' + app_data.Publisher + '/' + app_data.Application;
}

function purchase_user_login_status(opts, cb)
{
  // request for a page on subsription to check login status
  var app_data = opts.app_data;
  purchase_dialog_submit({
    type: 'user',
    client: app_data.Publisher,
    app: app_data.Application,
    service: app_data.UserService,
    wasession: opts.wasession,
    silent: true
  }, cb);

}
function purchase_dialog_open(opts)
{
  var type = opts.type,
  dlg = $('#purchase-dialog'),
  auth;
  if(dlg.length === 0)
    return;
  if(type == 'user')
  {
    if(opts.user_login_status !== false)
    {
      purchase_dialog_submit($.extend(false, { silent: true }, opts), 
                             function(success)
        {
          if(!success)
          {
            setup();
          }
        });
    }
    else
      setup();
  }
  else
  {
    try {
      auth = JSON.parse(localStorage.getItem(reader_auth_key(opts.app_data)));
    }catch(e) {
    }
    if(auth && auth.type == type)
    {
      purchase_dialog_submit($.extend({}, opts, auth), function(success)
        {
          if(!success)
          {
            localStorage.setItem(reader_auth_key(opts.app_data), null)
            setup();
          }
        });
    }
    else
      setup();
  }
  function setup()
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
    if(opts.user || opts.pswd)
    {
      query.user = opts.user;
      query.pswd = opts.pswd;
    }
    else if(opts.wasession)
    {
      query.wasession = opts.wasession+'';
    }
    url_str = 'http://download.librelio.com/downloads/subscribers.php?' +
      querystring.stringify(query);
    break;
  case 'code':
    query.code = opts.code;
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
    xhrFields: {
      withCredentials: true
    },
    dataType: 'xml',
    success: function(xmlDoc)
    {
      var $xmlDoc = $(xmlDoc),
      $err = $xmlDoc.find('Error'),
      $url = $xmlDoc.find('UrlString');
      if($err.length > 0)
      {
        if(!opts.silent)
          show_login_result($err.find('Message').text());
        cb && cb(false);
      }
      else if($url.length > 0)
      {
        var url_str = $url.text(),
        auth_obj = { type: opts.type };
        if(opts.type == 'code')
        {
          auth_obj.code = query.code;
          localStorage.setItem(reader_auth_key(opts.app_data), 
                               JSON.stringify(auth_obj));
        }
        if(!opts.urlstring)
        {
          if(!opts.silent)
            show_login_result();
        }
        else
        {
          var path_str = url_path_plus(url_str),
          prefix = opts.client + '/' + opts.app + '/',
          pidx = path_str.indexOf(prefix);
          if(pidx > -1 && ((pidx == 1 && path_str[0] == '/') || pidx === 0 ))
            path_str = path_str.substr(pidx + prefix.length);
          document.location = magazine_pdfreader_link_for(path_str);
        }
        cb && cb(true);
      }
      else
      {
        cb && cb(false);
        var err = _("Unknown response!");
        if(!opts.silent)
          show_login_result(err);
      }
    },
    error: function(xhr, err, err_txt)
    {
      cb && cb(false);
      if(!opts.silent)
        show_login_result(new Error(err_txt));
    }
  });
}
function magazine_pdfreader_link_for(path_str)
{
  var doc_query = querystring.parse(get_url_query(document.location+'')),
  params = {
    waurl: '/' + path_str // using leading slash it will load
                          // file from application's storage
  },
  inherit_params_key = [ 'wapublisher', 'waapp' ];
  for(var i = 0, l = inherit_params_key.length; i < l; ++i)
  {
    var key = inherit_params_key[i];
    if(doc_query[key])
      params[key] = doc_query[key];
  }
  return 'pdfreader.html?' + querystring.stringify(params);
}
$(function()
  {
    $('#purchase-dlg-submit').click(function()
      {
        // make a request
        var dlg = $('#purchase-dialog'),
        opts = dlg.data('pdata');
        if(opts)
        {
          var eopts = $.extend(false, {}, opts);
          switch(opts.type)
          {
          case 'user':
            eopts.user = $('#purchase-dlg-user-inp').val();
            eopts.pswd = $('#purchase-dlg-pass-inp').val();
            break;
          case 'code':
            eopts.code = $('#purchase-dlg-code-inp').val();
            break;
          }
          purchase_dialog_submit(eopts);
        }
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
function app_settings_link(publisher, app, path)
{
  return s3bucket_file_url(publisher + '/' + app + '/APP_/Uploads/' + path);
}
function application_info_load(opts, cb)
{
  opts = opts || {};
  var app_url;
  if(opts.wapublisher && opts.waapp && (document.location+'').match(/(localhost|librelio|serverfire)/))
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
        if(data.GACode)
          googleAnalyticsInit(data.GACode);
        else // google analytics should be always available
          window.gaTracker = function() { };
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

function reader_supported()
{
  var doc_query = querystring.parse(get_url_query(document.location+''));
  if(doc_query.waversion != 'html5' &&
     navigator.userAgent.match(/(iPhone|iPod|iPad|Android)/))
    return false;
  return true;
}

function reader_notify_not_supported(app_data)
{
  $('#notsupported-native-link').attr('href', "librelio://librelio-europe.s3.amazonaws.com/" + app_data.Publisher + "/" + app_data.Application + "/Magazines.plist");
  $('#notsupported-force-link').attr('href', "http://reader.librelio.com?" + 
                                    querystring.stringify({
                                      wapublisher: app_data.Publisher,
                                      waapp: app_data.Application,
                                      waversion: 'html5'
                                    }));
  $('#notsupported-modal').modal({
    keyboard: false,
    backdrop: 'static'
  });
}

function googleAnalyticsInit(ga_id)
{

// init code
(function(i,s,o,g,r,a,m){i.GoogleAnalyticsObject=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','gaTracker');

  gaTracker('create', ga_id, 'auto');
  
}

function addCSSFile(url, appendto, callback)
{
  if(!callback && typeof appendto == 'function')
  {
    callback = appendto;
    appendto = null;
  }
  var link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('type', 'text/css');
  link.setAttribute('href', url);
  if(callback)
  {
    link.onload = function()
    {
      callback();
    }
    link.onerror = function()
    {
      callback(new Error("An error occurred loading the stylesheet: " + url));
    }
  }
  if(appendto)
    appendto.appendChild(link);
  else
    document.getElementsByTagName('head')[0].appendChild(link);
}
