function notifyError(err)
{
  alert(err);
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
