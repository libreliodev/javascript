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
    $slides_wrp.find('.slides li > *').each(function()
      {
        if(this.nodeName == 'IMG')
          slideshow_update_image_size($slides_wrp, this);
        else
          slide_align_child_center($slides_wrp, this);
      });
    $slides_wrp.data('resizing', false);
  }
  function $element_toggle_visibility($el, b)
  {
    if(b)
      $el.show();
    else
      $el.hide();
  }
  function slide_align_child_center($slides_wrp, el)
  {
    var $container = $slides_wrp.find('.flex-viewport').length > 0 ?
      $slides_wrp.find('.flex-viewport') : $slides_wrp,
    $el = $(el),
    sh = $container.height(),
    $parent = $el.parent();
    $parent.css({
      'position': 'relative',
      'height': sh
    });
    $el.css({
      left: '50%',
      top: '50%',
      marginTop: -$el.height()/2,
      marginLeft: -$el.width()/2,
      position: 'absolute'
    });
  }
  function slideshow_update_image_size($slides_wrp, img)
  {
    var $container = $slides_wrp.find('.flex-viewport').length > 0 ?
      $slides_wrp.find('.flex-viewport') : $slides_wrp,
    $img = $(img),
    $parent = $img.parent(),
    sw = $parent.width(),
    sh = $container.height(),
    iwidth = img._orig_width,
    iheight = img._orig_height,
    scale;
    if(!iwidth || !iheight)
      return;
    if(iwidth / iheight > sw / sh)
      scale = sw / iwidth;
    else
      scale = sh / iheight;
    var nw = iwidth * scale,
    nh = iheight * scale;
    $img.css({
      width: nw,
      height: nh
    });
    slide_align_child_center($slides_wrp, $img);
  }
  pdf_viewer.bind('render-link', function(ev, data, page)
     {
       var url_str = data.url,
       url_path = url('path', url_str),
       file_ext = path.extname(url_path),
       query = querystring.parse(url('?', url_str));
       // image file
       if(img_exts.indexOf(file_ext.toLowerCase()) != -1 &&
          query.play == 'auto' && !data.element)
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
       query = querystring.parse(url('?', url_str)),
       file_ext = path.extname(url('path', url_str));
       // image file
       if(img_exts.indexOf(file_ext.toLowerCase()) != -1 && 
          obj.return_value !== false)
       {
         var el = data.element._slideshow_el || $('<div/>')[0],
         link_el = data.element;
         data.element = el;
         if(!link_el._slideshow_el)
         {
           if(!initSlideshow(data, page))
           {
             data.element = link_el;
             return;
           }
           link_el._slideshow_el = el;
           el._link_el = link_el;
           $(link_el.parentNode).append(el);
         }
         else
         {
           // this block of code is only for warect=full
           link_el = el._link_el;
           el.playbackToggle(true);
         }
         if(query.warect == 'full')
         {
           $element_toggle_visibility($(el), true);
           $element_toggle_visibility($(link_el), false);
         }
         obj.return_value = false;
       }
     })
  function initSlideshow(data, page)
  {
    function toggleFullWindow(playb)
    {
      pdf_viewer.pdfviewer('set', 'auto_resizable', false);
      $('body').toggleClass('in-fullscreen-view', playb);
      $slides_wrp.toggleClass('fullscreen-view', playb);
      // for some reason 'fullscreen-view' will be removed
      // first time I'll set it again after awhile
      setTimeout(function()
        {
          if(playb)
            slideshow_size_update($slides_wrp);
          $slides_wrp.toggleClass('fullscreen-view', playb);
          pdf_viewer.pdfviewer('set', 'auto_resizable', !playb);
        }, 500);
    }
    function onplayback_change(playb)
    {
      if(!playb && $slides_wrp[0]._link_el)
      {
        var link_el = $slides_wrp[0]._link_el;
        $element_toggle_visibility($slides_wrp, false);
        $element_toggle_visibility($(link_el), true);
        data.element = link_el;
      }
    }
    function playback_toggle(b)
    {
      onplayback_change(b);
      if(query.warect == 'full')
        toggleFullWindow(b);
      else
        setTimeout(function()
          {
            pdf_viewer.pdfviewer('set', 'auto_resizable', false);
            slideshow_size_update($slides_wrp);
            pdf_viewer.pdfviewer('set', 'auto_resizable', true);
          });
      $slides_wrp.flexslider(b ? 'play' : 'pause');
    }
    data.element.playbackToggle = playback_toggle;
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
        this._orig_width = this.width;
        this._orig_height = this.height;
        this._li.empty().append(this);
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
        img[0]._li = li;
        li[0]._img = img;
        img.bind('load', image_loaded);
        img.prop('src', librelio_resolve_url(s, pdf_url_dir));
        var $loading_el = $('<div>Loading...</div>')
          .width(70).height(20);
        slide_align_child_center($slides_wrp, $loading_el);
        li.append($loading_el);
        $slides.append(li);
      }
      on($slides_wrp, releaser, 'click', '.flex-pauseplay a', function()
        {
          var slider = $slides_wrp.data('flexslider'),
          playb = !$(this).hasClass(slider.vars.namespace + 'play');
          if(query.warect == 'full')
          {
            onplayback_change(playb);
            toggleFullWindow(playb);
          }
        })
      ('click', '.slides', function()
        {
          var slider = $slides_wrp.data('flexslider'),
          playb = $slides_wrp.find('.flex-pauseplay a')
            .hasClass(slider.vars.namespace + 'play');
          $slides_wrp.flexslider(playb ? 'play' : 'pause');
          if(query.warect == 'full')
          {
            onplayback_change(playb);
            toggleFullWindow(playb);
          }
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
      
      on($(window), releaser, 'resize', function()
        {
          if($slides_wrp.hasClass('fullscreen-view') && 
             !$slides_wrp.data('resizing'))
            slideshow_size_update($slides_wrp);
        });
      playback_toggle(true);
    }
    return true;
  }
});
