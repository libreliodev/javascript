$(function(){
  var img_exts = [ '.png', '.gif', '.jpg', '.jpeg' ],
  pdf_viewer = $('.pdfviewer'),
  max_icons_size = 1;
  function slideshow_size_update($slides_wrp)
  {
    var width = $slides_wrp.width(),
    size = width / 150,
    slider = $slides_wrp.data('flexslider');
    
    $slides_wrp.data('resizing', true);
    if(slider)
      slider.resize();
    if(size > max_icons_size)
      size = max_icons_size;
    var s = size * 36 + 4;
    $slides_wrp.find('.flex-direction-nav a').css({
      width: s,
      height: s,
      marginTop: -s/2,
      fontSize: s
    });
    $slides_wrp.find('.flex-pauseplay a').css('fontSize', size * 16 + 4);

    $slides_wrp.find('img').each(function()
      {
        if(this.width || this.height)
          slideshow_update_image_size($slides_wrp, this);
      });
    $slides_wrp.data('resizing', false);
  }
  function slideshow_update_image_size($slides_wrp, img)
  {
    var orig_img = new Image();
    orig_img.src = img.src;
    orig_img.onload = function()
    {
      var $container = $slides_wrp.find('.flex-viewport').length > 0 ?
        $slides_wrp.find('.flex-viewport') : $slides_wrp,
      $img = $(img),
      $parent = $img.parent(),
      sw = $parent.width(),
      sh = $container.height(),
      ratio = orig_img.width / orig_img.height,
      scale;
      if(ratio >= 1)
        scale = sw / orig_img.width;
      else
        scale = sh / orig_img.height;
      $parent.css({
        'position': 'relative',
        'height': sh
      });
      var nw = orig_img.width * scale,
      nh = orig_img.height * scale;
      $img.css({
        width: nw,
        height: nh,
        left: '50%',
        top: '50%',
        marginTop: -nh/2,
        marginLeft: -nw/2,
        position: 'absolute'
      });
    }
  }
  pdf_viewer.bind('render-link', function(ev, data, page)
     {
       var url_str = data.url,
       url_path = url('path', url_str),
       file_ext = path.extname(url_path),
       query = querystring.parse(url('?', url_str));
       // image file
       if(img_exts.indexOf(file_ext.toLowerCase()) != -1 &&
          query.play == 'auto')
       {
         var el = $('<div/>')[0],
         tmp = data.element;
         data.element = el;
         if(!initSlideshow(data, page))
         {
           data.element = tmp;
           return;
         }
       }
     })
   .bind('openlink', function(ev, obj, page)
     {
       var data = obj.data,
       url_str = data.url,
       file_ext = path.extname(url('path', url_str));
       // image file
       if(img_exts.indexOf(file_ext.toLowerCase()) != -1)
       {
         var el = $('<div/>')[0],
         tmp = data.element;
         data.element = el;
         data.play = 'auto';
         if(!initSlideshow(data, page))
         {
           data.element = tmp;
           return;
         }
         $(tmp).replaceWith(el);
         obj.return_value = false;
       }
     })
  function initSlideshow(data, page)
  {
    function toggleFullWindow(playb)
    {
      $('body').toggleClass('in-fullscreen-view', playb);
      $slides_wrp.toggleClass('fullscreen-view', playb);
      pdf_viewer.pdfviewer('set', 'auto_resizable', false);
      slideshow_size_update($slides_wrp);
      pdf_viewer.pdfviewer('set', 'auto_resizable', !playb);
      // for some reason 'fullscreen-view' will be removed
      // first time I'll set it again after awhile
      setTimeout(function()
        {
          $slides_wrp.toggleClass('fullscreen-view', playb);
        }, 500);
    }
    var url_str = data.url,
    url_path = url('path', url_str),
    file_ext = path.extname(url_path),
    query = querystring.parse(url('?', url_str)),
    $slides_wrp = $(data.element).addClass('slideshow').addClass('flexslider'),
    $slides = $('<ul/>').addClass('slides'),
    rect = data.rect,
    releaser = [],
    file_dirname = path.dirname(url_path),
    file_basename = path.basename(url_path, file_ext),
    tmp = file_basename.split('_'),
    start = 1,
    end = tmp.length > 1 ? parseInt(tmp[tmp.length - 1]) : NaN,
    exit_proc, initialized;
    if(isNaN(end) || end < start)
      return false;
    file_basename = tmp.slice(0, tmp.length - 1).join('_');
    
    $slides_wrp.css({
      left: rect[0],
      top: rect[1],
      width: rect[2],
      height: rect[3]
    });
    on($slides_wrp, null, 'click', false)
    ('mousedown', false)
    ('mouseup', false);
    on(pdf_viewer, releaser, 'pagecurl-start', function()
      {
        $slides_wrp.animate({ opacity: 0 }, {
          queue: false,
          duration: 200
        });
      })
    ('pagecurl-end', function()
      {
        $slides_wrp.animate({ opacity: 1 }, {
          queue: false,
          duration: 200
        });
      })
    ('curPages-changed', function(ev, curPages)
      {
        if(!initialized && curPages.indexOf(page) != -1)
        {
          init_slideshow()
          return;
        }
        exit_Proc = true;
        $slides_wrp.remove();
        funcListCall(releaser);
      });
    var curPages = pdf_viewer.pdfviewer('get', 'curPages');
    if(curPages.indexOf(page) != -1)
    {
      init_slideshow();
      initialized = true;
    }
    function init_slideshow()
    {
      if(exit_proc)
        return;
      function image_loaded()
      {
        slideshow_update_image_size($slides_wrp, this);
      }
      var path_host = url_till_hostname(url_str);
      for(var i = start, l = end + 1; i < l; ++i)
      {
        var rel_path = path.join(file_dirname, 
                                 file_basename + '_' + i + file_ext),
        s = path_host + (rel_path[0] == '/' ? '' : '/') + rel_path,
        img = $('<img/>'),
        li = $('<li/>');
        img.bind('load', image_loaded);
        img.prop('src', librelio_resolve_url(s, pdf_url_dir));
        $slides.append(li.append(img));
      }
      $slides_wrp.on('click', '.flex-pauseplay a', function()
        {
          var slider = $slides_wrp.data('flexslider'),
          playb = !$(this).hasClass(slider.vars.namespace + 'play');
          if(query.warect == 'full')
            toggleFullWindow(playb);
        });
      var delay = query.wadelay && !isNaN(parseInt(query.wadelay)) ? 
        parseInt(query.wadelay) : 7000,
      bgcolor = query.wabgcolor || 'black';
      $slides_wrp.append($slides)
        .addClass('slideshow-theme-' + bgcolor)
        .flexslider({
          animation: 'slide',
          pausePlay: true,
          slideshowSpeed: delay, //Integer: Set the speed of the slideshow cycling, in milliseconds
          animationSpeed: query.watransition == 'none' ? 0 : 600, //Integer: Set the speed of animations, in milliseconds
          controlNav: false,
          nextText: '',
          prevText: '',
          pauseText: '',
          playText: ''
        });
      $slides_wrp.flexslider('pause');
      
      slideshow_size_update($slides_wrp);
      on($(window), releaser, 'resize', function()
        {
          if($slides_wrp.hasClass('fullscreen-view') && 
             !$slides_wrp.data('resizing'))
            slideshow_size_update($slides_wrp);
        });

      if(query.waplay == 'auto' || data.play == 'auto')
      {
        setTimeout(function()
          {
            if(query.warect == 'full')
              toggleFullWindow(true);
            $slides_wrp.flexslider('play');
          });
      }
    }
    return true;
  }
});
