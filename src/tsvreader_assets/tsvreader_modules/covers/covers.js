var __dirname = TSVReaderModule.dirname;
default_tmpl_url = __dirname + 'covers.tmpl',
tsv_columns_name = [ 'filename', 'title', 'date', 'description' ];


TSVReaderModule.ready = function()
{
  var reader = new TSVReader(),
  featured_html;
  reader.get_tsv_element = function() { return TSVReaderModule.element; };
  reader.default_template_url = default_tmpl_url;
  reader.row_content = function(in_row)
  {
    var row = {};
    for(var i = 0; i < tsv_columns_name.length; ++i)
      row[tsv_columns_name[i]] =  in_row[i];
    var fn = paid2free(row.filename||'', true);
    row.img_url = reader.tsv_urldir + '/' + fn + '_newsstand.png';
    row.img_thumbnail_url = reader.tsv_urldir + '/' + fn + '.png';
    row.is_paid = is_paid(row.filename||'');
    return row;
  }
  var tsv_url = TSVReaderModule.tsv_url,
  tmpl_url = TSVReaderModule.tmpl_url,
  wrp_el = $(TSVReaderModule.element),
  app_data = TSVReaderModule.app_data,
  doc_query = TSVReaderModule.doc_query,
  html5_info = {},
  subscriptions = [],
  subscriptions_names = [ 'Subscription_1', 'Subscription_2' ],
  user_login_status;
  wrp_el.hide();
  reader.load(tsv_url, tmpl_url, function(err)
    {
      var covers_wrp = $('#covers-wrp');
      if(err)
      {
        covers_wrp.show();
        notifyError(err);
        return;
      }
      async.parallel([
        function(callback)
        {
          $.ajax(app_settings_link(app_data.Publisher, app_data.Application, 
                                   'setup-html5.plist'), {
            dataType: 'xml'
          }).success(function(xml)
            {
              var info = $.plist(xml);
              if(info)
                html5_info = info;
              callback()
            })
            .fail(function(xhr, textStatus, err)
              {
                callback();
              });
        },
        function(callback)
        {
          addCSSFile(app_settings_link(app_data.Publisher, 
                                       app_data.Application, 
                                       'style_covers.css'), wrp_el[0], 
                     function(err) { callback(); });
        }
      ],function()
        {
          // init subscriptions
          for(var i = 0; i < subscriptions_names.length; ++i)
          {
            var name = subscriptions_names[i];
            if(html5_info[name + '_Title'])
              subscriptions.push({
                'title': html5_info[name + '_Title'],
                'link': html5_info[name + '_Link'] || ''
              });
          }
          reader.global_ctx.subscriptions = subscriptions;

          wrp_el.show();
          reader.global_ctx.logged_in = false;
          purchase_user_login_status({
            app_data: app_data,
            wasession: doc_query.wasession
          }, function(status)
             {
               user_login_status = status;
               reader.global_ctx.logged_in = status;
             });
          var list = document.getElementById('covers-list'),
          featured = document.getElementById('featured-cover'),
          has_featured = featured && featured.offsetHeight > 0;
          covers_wrp.toggleClass('no-featured', !has_featured);
          reader.global_ctx.has_featured = has_featured;
          if(list)
          {
            reader.update_table(list, {
              open_cover_details_dialog: open_cover_details_dialog
            }, has_featured ? 1 : 0);
          }

          if(has_featured && reader.rows.length > 0)
          {
            featured_html = featured.innerHTML;
            var ctx = {
              index: 0,
              row: reader.rows[0],
              open_cover_details_dialog: open_cover_details_dialog
            };
            $(featured).dhtml('item_init', [ ctx, reader.global_ctx ], 
                              { recursive: true });

          }
        });
    });

  function open_cover_details_dialog(index, row)
  {
    var $cover_details = $('#cover-details');
    if(!$cover_details.data('_original_html'))
      $cover_details.data('_original_html', $cover_details.html());
    else
      $cover_details.html($cover_details.data('_original_html'));

    var ctx = {
      index: 0,
      row: row,
      open: function()
      {
        var fn = paid2free(row.filename),
        ext = path.extname(fn), url;
        if(row.is_paid && user_login_status)
        {
          read_paid_file(item);
        }
        else
        {
          if(ext == '.pdf')
            url = magazine_pdfreader_link_for(fn)
          else
            return false; // do nothing url = magazine_file_url(app_data, fn);
        
          document.location = url;
        }
      }
    };
    $cover_details.dhtml('item_init', [ ctx, reader.global_ctx ], 
                         { recursive: true });

    $cover_details.modal({ });
    $cover_details.modal('show');
  }
  function read_paid_file(item)
  {
    var type = app_data.CodeService ? 'code' : 
      (app_data.UserService ? 'user' : null);
    var service_name = app_data.CodeService ? app_data.CodeService : 
      (app_data.UserService ? app_data.UserService : null);
    if(!type)
      return;

    purchase_dialog_open({
      type: type,
      client: app_data.Publisher,
      app: app_data.Application,
      service: service_name,
      urlstring: (item.filename[0] != '/' ? '/' : '') + item.filename,
      app_data: app_data,
      user_login_status: user_login_status
    });
  }

}
function paid2free(fn, noext)
{
  var ext = path.extname(fn),
  bn = path.join(path.dirname(fn), path.basename(fn, ext));
  return (bn.length > 0 && bn[bn.length - 1] == '_' ? 
          bn.substr(0, bn.length - 1) : bn) + (noext ? '' : ext);
}

function is_paid(fn)
{
  var bn = path.basename(fn, path.extname(fn));
  return bn.length > 0 && bn[bn.length - 1] == '_';
}
