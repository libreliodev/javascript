$(function(){
  // load application_.json data
  var doc_query = querystring.parse(get_url_query(document.location+'')),
  magazines_list = $('.magazines').eq(0),
  magazines_container = $('.reader-container').eq(0),
  app_data,
  MAG_TYPE_FREE = 'Free',
  MAG_TYPE_PAID = 'Paid',
  refresh_timeout,
  update_every,
  pub_name = window.accept_wapublication ? doc_query.wapublication || '' : '',
  pub_prefix = pub_name ? pub_name + '/' : '',
  featured = $('#featured-cover'),
  featured_html,
  subscriptions = [],
  subscriptions_names = [ 'Subscription_1', 'Subscription_2' ],
  global_ctx = {
    MAG_TYPE_PAID: MAG_TYPE_PAID,
    MAG_TYPE_FREE: MAG_TYPE_FREE,
    open_pub: open_pub,
    subscriptions: subscriptions,
    magazine_open: magazine_open,
    open_cover_details_dialog: open_cover_details_dialog
  };
  
  magazines_init(magazines_list);

  $('body').hide();
  application_info_load(doc_query, function(err, data)
     {
       app_data = data;
       if(window.redirect_to_pages)
       {
         var query = $.extend(false, {}, doc_query), url_str,
         query_str = querystring.stringify(query);
         query_str = query_str ? '?' + query_str : '';
         if(data.PublicationType == 'multiple' && !query.wapublication)
           url_str = 'publications.html' + query_str;
         else
           url_str = 'issues.html' + query_str;
         document.location = url_str;
         return;
       }
       if(!reader_supported())
       {
         $('body').show();
         return reader_notify_not_supported(data);
       }
       if(err)
       {
         $('body').show();
         return notifyError(err);
       }
       // get update rate it's in minutes
       var rootView = pub_name ? pub_name + '.plist' : data.RootView,
       q = querystring.parse(get_url_query(rootView)) || {},
       basename = path.basename(path_without_query(rootView)),
       ext = path.extname(basename),
       _update_every = parseFloat(q.waupdate);
       update_every = (isNaN(_update_every) ? 30 : _update_every)*60*1000;
       // remove extension from basename
       basename = path.basename(basename, ext);

        if(data.GACode)
          googleAnalyticsInit(data.GACode);
        else // google analytics should be always available
          window.gaTracker = function() { };
       // track pageview
       gaTracker('send', 'pageview', {
         'page': 'Library/' + pub_prefix + basename
       });

       switch(ext)
       {
       case '.plist':
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
                                          'style_covers.css'), 
                        magazines_container[0], 
               function(err) { callback(); });
           }
         ],function()
           {
             $('body').show();
             
             if(app_data.UserService)
             {
               purchase_user_login_status({
                 app_data: app_data,
                 wasession: doc_query.wasession
               }, function(status)
                  {
                    user_login_status = status;
                    login_status_update();
                  });
             }
             else
             {
               login_status_update();
             }
             
             magazines_load(data, magazines_list, magazines_loaded_handle);

             // set background
             if(data.BackgroundColor)
             {
               var color = new RGBColor(data.BackgroundColor),
               invert_color;
               if(color.ok)
               {
                 var bright = ((color.r + color.g + color.b) / 255 / 3) > 0.5;
                 $('body').toggleClass('light-bkg', bright)
                   .toggleClass('dark-bkg', !bright);
                 invert_color = 'rgb(' + (255 - color.r) + ',' + (255 - color.g) +
                   ',' + (255 - color.b) + ')';
               }
               $('<style type="text/css" />').html(
                 'body, .headline, .label-default { background-color:' + data.BackgroundColor + ' !important; }' +
                   (invert_color ? '.label-default[href]:hover, .label-default[href]:focus { background-color:' + invert_color + ' !important; }' : '')).appendTo('head');
             }
             $('.reader-background').css('backgroundImage', 
                                         'url("' + magazine_file_url(data, 'APP_/Uploads/Magazines_background.png') +'")');

             $('#logo-btn img').attr('src', magazine_file_url(data, 'APP_/Uploads/logo'));

             // links to sites
             var $logo_dropdown_list = $("#logo-btn").parent().find('.dropdown-menu'),
             sites_to_class = { WebSite: 'site-item', Facebook: 'facebook-item' };
             for(var site in sites_to_class)
             {
               var $site_li = $logo_dropdown_list.find('.' + sites_to_class[site]);
               if(data[site])
                 $site_li.find('a').attr('href', data[site]);
               else
                 $site_li.hide();
             }
           });
         break;
       case '.tsv':
         $('body').show();
         function load_scripts(paths, cb)
         {
           async.parallel(paths.map(function(p)
                            {
                              return function(cb)
                              {
                                $.ajax({
                                  url: p,
                                  dataType: 'script',
                                  success: function()
                                  {
                                    cb();
                                  },
                                  error: function(xhr, err, err_text)
                                  {
                                    cb("Couldn't load script: " + p);
                                  }
                                });
                              }
                            }), function(err)
             {
               if(err)
                 return notifyError(err);
               cb();
             });
         }
         var scripts = [ 'lib/d3.min.js',
                         'lib/taffy-min.js',
                         'js/sharelist.js',
                         'js/tsvreader.js',
                         'js/TSVReaderModuleLoader.js',
                         'js/tsvreader-main.js' ];
         load_scripts(scripts.map(function(p){ return assets + '/' + p }), 
                      function()
           {
             var tsv_url = magazines_url(data),
             tsv_url_dir = url_dir(tsv_url);
             tmpl_url = TSVReader.template_url(tsv_url, tsv_url_dir),
             module_name = q.wamodule,
             tsvreader_el = $('<div id="tsvreader"/>')[0];
             magazines_container.replaceWith(tsvreader_el);
             $('body').removeClass('dark-bkg').removeClass('light-bkg');
             if(!module_name)
               module_name = 'covers';
             var moduleLoader = new TSVReaderModuleLoader(module_name, 
                                                          tsvreader_el);
             moduleLoader.supply = {
               doc_query: q,
               tmpl_url: tmpl_url,
               tsv_url: tsv_url,
               app_data: app_data
             };
             moduleLoader.load(function(err)
               {
                 
               });
           });
         break;
       default:
         $('body').show();
         notifyError(sprintf(_('File extension not supported: %s'), 
                             rootView));
       }
     });
  function magazines_loaded_handle(err)
  {
    if(err)
      console.log(err);
    if(refresh_timeout !== undefined)
      clearTimeout(refresh_timeout);
    refresh_timeout = setTimeout(function()
      {
        magazines_load(app_data, magazines_list, magazines_loaded_handle);
        refresh_timeout = undefined;
      }, update_every);
  }
  function magazines_init(list)
  {
    list.dhtml('list_init');
    function catchLIElement(el)
    {
      var li = $(el).parent();
      while(li.prop('tagName') != 'LI')
        li = li.parent();
      if(li.prop('tagName') != 'LI')
        return null;
      return li;
    }
    list.on('click', '.mag-sample-btn, .mag-read-btn', function()
      {
        var li = catchLIElement(this)
        if(!li)
          return;
        var item = li.data('item');
        if(item)
          magazine_open(item, !$(this).hasClass('mag-read-btn'));
        return false;
      });
  }
  function magazine_open(item, for_sample)
  {
    var fn = paid2free(item.FileName),
    ext = path.extname(fn), url;
    if(!for_sample && item.type != MAG_TYPE_FREE)
    {
      read_paid_file(item);
    }
    else
    {
      if(ext == '.pdf')
        url = magazine_pdfreader_link_for(pub_prefix + fn);
      else
        return false; // do nothing url = magazine_file_url(app_data, fn);
      
      document.location = url;
    }
  }
  function read_paid_file(item)
  {  
    var type = app_data.CodeService ? 'code' : 
      (app_data.UserService ? 'user' : null);
    var service_name = app_data.CodeService ? app_data.CodeService : 
      (app_data.UserService ? app_data.UserService : null);
    if(!type)
      return;
    var key = pub_prefix + item.FileName;
    purchase_dialog_open({
      type: type,
      client: app_data.Publisher,
      app: app_data.Application,
      service: service_name,
      urlstring: (key[0] != '/' ? '/' : '') + key,
      app_data: app_data,
      user_login_status: user_login_status
    });
  }
  function open_pub(pubname)
  {
    var query = $.extend(false, {}, doc_query);
    query.wapublication = pubname;
    var query_str = querystring.stringify(query);
    query_str = query_str ? '?' + query_str : '';
    document.location = 'issues.html' + query_str;
    return false;
  }
  function open_cover_details_dialog(index, row)
  {
    var $cover_details = $('#cover-details');
    if(!$cover_details.data('_original_html'))
      $cover_details.data('_original_html', $cover_details.html());
    else
      $cover_details.html($cover_details.data('_original_html'));

    var ctx = {
      index: 0,
      row: row
    };
    $cover_details.dhtml('item_init', [ ctx, global_ctx ], 
                         { recursive: true });

    $cover_details.modal({ });
    $cover_details.modal('show');
  }
  function magazines_create_item(index, item, data, list)
  {
    var li = list.dhtml('list_new_item', null, [ {
      index: index,
      row: item
    }, global_ctx ]);
    li.addClass('mag-type-' + (item.type == MAG_TYPE_PAID ? 'paid' : 'free'));
    return li;
  }
  function magazines_load(data, list, cb)
  {
    var rootView = pub_name ? pub_name + '.plist' : data.RootView,
    filename = rootView;
    $.ajax(magazines_url(data), {
      dataType: 'xml'
    }).success(function(xml)
         {
           var items = $.plist(xml);
           if(!items)
             return cb && cb(new Error(_(sprintf("Counldn't parse `%s`"), 
                                         filename)));

           var has_featured = featured.length > 0 && featured.height() > 0 &&
             featured.is(':visible');
           magazines_container.toggleClass('no-featured', !has_featured);
           global_ctx.has_featured = has_featured;
           
           list.html('');
           for(var i = 0, l = items.length; i < l; ++i)
           {
             var item = items[i],
             fn = item.FileName;
             item.type = magazine_type(fn);
             item.ThumbnailUrl = 
               magazine_file_url(data, magazine_get_thumbnail_by_filename(fn));
           }

           for(var i = has_featured ? 1 : 0, l = items.length; i < l; ++i)
           {
             var item = items[i];
             list.append(magazines_create_item(i, item, data, list)
                         .data('item', item));
           }

          if(has_featured && items.length > 0)
          {
            if(!featured_html)
              featured_html = featured.html();
            else
              featured.html(featured_html);
            var ctx = {
              index: 0,
              row: items[0]
            };
            featured.dhtml('item_init', [ ctx, global_ctx ], 
                              { recursive: true });
          }

           cb && cb(null, items);
         })
      .fail(function(xhr, textStatus, err)
         {
           cb && cb(new Error(sprintf(_("Couldn't load `%s`: %s"), filename,
                                      err)));
         });
  }
  function magazine_file_url(data, file)
  {
    return '//' + config.s3Bucket + '.s3.amazonaws.com/' + 
      magazine_file_key(data, file);
  }
  function magazine_file_key(data, file)
  {
    return data.Publisher + '/' + data.Application + '/' + file;
  }
  function magazines_url(data)
  {
    var rootView = pub_name ? pub_name + '.plist' : data.RootView;
    return  magazine_file_url(data, pub_prefix + rootView);
  }
  function magazine_get_thumbnail_by_filename(fn)
  {
    return window.show_publications ? fn + '/' + fn + '.png' : 
      paid2free(fn, true) + '.png';
  }
  function magazine_type(fn)
  {
    var bn = path.basename(fn, path.extname(fn));
    return bn.length > 0 && bn[bn.length - 1] == '_' ? 
      MAG_TYPE_PAID : MAG_TYPE_FREE;
  }
  function paid2free(fn, noext)
  {
    var ext = path.extname(fn),
    bn = path.join(path.dirname(fn), path.basename(fn, ext));
    return (bn.length > 0 && bn[bn.length - 1] == '_' ? 
            bn.substr(0, bn.length - 1) : bn) + (noext ? '' : ext);
  }

  // login/logout
  // There's two buttons in the page, User should be able to logout or login
  // with these buttons. One of them should be visible at a time.
  // CodeService and UserService does support login choice.
  // login dialog could be the same as purchase dialog with few changes.
  var user_login_status = false;
  $('#login-btn').click(function()
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
        submit_callback: function(success)
        {
          user_login_status = success;
          login_status_update();
        },
        app_data: app_data,
        user_login_status: user_login_status
      });
      return false;
    });
  $('#logout-btn').click(function()
    {
      if(app_data.UserService)
      {
        $.ajax({
          url: 'http://download.librelio.com/downloads/logout.php',
          xhrFields: {
            withCredentials: true
          },
          success: function()
          {
            user_login_status = false;
            login_status_update();
          },
          error: function(xhr, err, err_txt)
          {
            notifyError('Logout request error: ' + xhr.status);
          }
        });
      }
      else
      {
        localStorage.setItem(reader_auth_key(app_data), '');
        login_status_update(false);
      }
      return false;
    });
  function login_status_update(auth)
  {
    global_ctx.logged_in = user_login_status;
    auth = typeof auth != 'undefined' ? auth : 
      (app_data.UserService ? user_login_status : 
       !!localStorage.getItem(reader_auth_key(app_data)));
    $('#login-btn')[!auth ? 'show' : 'hide']();
    $('#logout-btn')[auth ? 'show' : 'hide']();
  }
});
