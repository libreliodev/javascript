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
  dlg = $('#purchase-dialog');
  if(dlg.length === 0)
    return;
  dlg.toggleClass('purchase-dialog-user-service', type == 'user')
    .toggleClass('purchase-dialog-code-service', type == 'code')
    .data('pdata', opts)
    .modal('show');
  
}
$(function()
  {
    $('#purchase-dlg-submit').click(function()
      {
        // make a request
        var dlg = $('#purchase-dialog'),
        opts = dlg.data('pdata');
        if(!opts)
          return;
        var url,
        query = {
          client: opts.client,
          app: opts.app_name, 
          service: opts.service,
          urlstring: opts.urlstring,
          deviceid: opts.deviceid
        };
        switch(opts.type)
        {
        case 'user':
          query.user = $('#purchase-dlg-user-inp').val();
          query.pswd = $('#purchase-dlg-pass-inp').val();
          url = 'http://download.librelio.com/downloads/subscribers.php?' +
            querystring.stringify(query);
          break;
        case 'code':
          query.code = $('#purchase-dlg-code-inp').val();
          url = 'http://download.librelio.com/downloads/pswd.php?' +
            querystring.stringify(query);
          break;
        default:
          return;
        }
        $.ajax(url, {
          success: function(data)
          {
            console.log(data);
          },
          error: function(xhr, err_text)
          {
            notifyError("Failed to request for page: " + err_text);
          }
        });
        return false;
      });

    $('#purchase-dlg-cancel').click(function()
      {
        $('#purchase-dialog').modal('hide')
          .find('input').val('');
        return false;
      });
  });
