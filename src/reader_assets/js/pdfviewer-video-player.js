$(function(){
  var video_exts = [ '.mov', '.mp4', '.flv', '.ogv' ],
  video_extension_types = {
    '.mov': 'video/mp4',
    '.mp4': 'video/mp4',
    '.ogv': 'video/ogg'
  },
  max_icons_size = 100,
  pdf_viewer = $('.pdfviewer');
  function $video_toggle_visibility($el, b)
  {
    var v = b ? 'visible' : 'hidden';
    $el.css('visibility', v);
     $el.find('.vjs-control-bar').css('visibility', v);
  }
  function video_size_update($vid_wrp, player)
  {
    var width = player.isFullWindow || player.isFullscreen()
      ? $(window).width() : player.width(),
    size = 200 / 640 * width;
    if(size > max_icons_size)
      size = max_icons_size;
    $vid_wrp.find('.vjs-control-bar')
      .css('fontSize', size + '%');
    $vid_wrp.find('.vjs-big-play-button')
      .css('fontSize', (size * 2) + '%');
  }
  pdf_viewer.bind('render-link', function(ev, data, page)
     {
       var url_str = data.url,
       file_ext = path.extname(url('path', url_str)),
       query = querystring.parse(url('?', url_str));
       // video file
       if(video_exts.indexOf(file_ext.toLowerCase()) != -1 &&
          query.waplay == 'auto')
       {
         data.element = $('<div/>')[0];
         initVideo(data, page);
       }
     })
   .bind('openlink', function(ev, obj, page)
     {
       var data = obj.data,
       url_str = data.url,
       query = querystring.parse(url('?', url_str)),
       file_ext = path.extname(url('path', url_str));
       // video file
       if(video_exts.indexOf(file_ext.toLowerCase()) != -1 && 
          obj.return_value !== false)
       {
         var el = data.element._video_el || $('<div/>')[0];
         el._link_el = data.element;
         if(!data.element._video_el)
         {
           $(data.element.parentNode).append(el);
           if(query.warect == 'full')
             $video_toggle_visibility($(data.element), false);
           data.element._video_el = el;
           data.element = el;
           data.play = 'auto';
           initVideo(data, page);
         }
         else
         {
           // this block of code is only for warect=full
           $video_toggle_visibility($(data.element), false);
           $video_toggle_visibility($(el), true);
           data.element = el;
           if(el.player)
             el.player.play();
         }
         obj.return_value = false;
       }
     })
  function initVideo(data, page)
  {
    function isAutoplay()
    {
      return query.waplay == 'auto' || data.play == 'auto';
    }
    var url_str = data.url,
    file_ext = path.extname(url('path', url_str)),
    query = querystring.parse(url('?', url_str)),
    qm_idx = url_str.indexOf('?'),
    src = qm_idx == -1 ? url_str : url_str.substring(0, qm_idx),
    type = video_extension_types[file_ext],
    $vid_wrp = $(data.element),
    $vid = $('<video class="video-js vjs-default-skin" controls ' +
             'poster="">' +
             '<source/>' +
             '<p class="vjs-no-js">To view this video please enable JavaScript, and consider upgrading to a web browser that <a href="http://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a></p>' +
             '</video>'),
    $source = $vid.find('source'),
    rect = data.rect,
    releaser = [],
    player, exit_proc,
    is_cur_page;
    $source.attr('src', librelio_resolve_url(src, pdf_url_dir));
    if(type)
      $source.attr('type', type);
    $vid.attr('width', rect[2])
      .attr('height', rect[3]).appendTo($vid_wrp);
    $vid_wrp.css({
      position: 'absolute',
      left: rect[0],
      top: rect[1],
      width: rect[2],
      height: rect[3]
    });
    on($vid_wrp, null, 'click', false)
    ('mousedown', function()
      {
        pdf_viewer.pdfviewer('set', 'moveable', false);
      })
    ('mouseup', function()
      {
        setTimeout(function()
          {
            pdf_viewer.pdfviewer('set', 'moveable', true);
          });
      });
    on(pdf_viewer, releaser, 'pagecurl-start', function()
      {
        $vid_wrp.animate({ opacity: 0 }, {
          queue: false,
          duration: 200,
          complete: function()
          {
            $vid_wrp.css('visibility', 'hidden');
          }
        });
      })
    ('pagecurl-end', function()
      {
        if($vid_wrp[0] == data.element)
          $vid_wrp.css('visibility', 'visible');
        $vid_wrp.animate({ opacity: 1 }, {
          queue: false,
          duration: 200,
          complete: function()
          {
            if($vid_wrp[0] == data.element)
              $vid_wrp.css('visibility', 'visible');
          }
        });
      })
    ('curPages-changed', function(ev, curPages)
      {
        if(curPages.indexOf(page) != -1 && !is_cur_page)
        {
          is_cur_page = true;
          if(player && isAutoplay())
            player.play();
          return;
        }
        exit_proc = true;
        if(player)
          player.dispose();
        $vid_wrp.remove();
        funcListCall(releaser);
      });

    videojs($vid[0], {}, function()
      {
        player = this;
        $vid_wrp[0].player = player;
        var play_m = player.play;
        player.play = function()
        {
          play_m.apply(this, arguments);
          if(query.warect == 'full')
          {
            pdf_viewer.pdfviewer('set', 'auto_resizable', true);
            player.enterFullWindow();
            player.trigger('fullscreenchange');
          }
        }
        if(exit_proc)
        {
          player.pause();
          player.dispose();
          return;
        }
        on($vid_wrp.find('.vjs-fullscreen-control'), 
           releaser, 'click', function()
          {
            pdf_viewer.pdfviewer('set', 'auto_resizable', false);
            setTimeout(function()
              {
                pdf_viewer.pdfviewer('set', 'auto_resizable', true);
              }, 500);
          });
        video_size_update($vid_wrp, player);
        var curPages = pdf_viewer.pdfviewer('get', 'curPages');
        on($vid_wrp, releaser, 'click', 
           '.vjs-big-play-button,.vjs-tech,.vjs-play-control', function()
          {
            if(query.warect == 'full')
            {
              if(player.paused())
                if($vid_wrp[0]._link_el)
                {
                  $video_toggle_visibility($vid_wrp, false);
                  $video_toggle_visibility($($vid_wrp[0]._link_el), true);
                  data.element = $vid_wrp[0]._link_el;
                }
              var b = player.isFullWindow;
              pdf_viewer.pdfviewer('set', 'auto_resizable', b);
              if(!b)
                player.enterFullWindow(); 
              else
                player.exitFullWindow();
              player.trigger('fullscreenchange');
            }
          });
        player.on('fullscreenchange', function()
          {
            if(player.isFullWindow)
              $vid_wrp.css({
                opacity: 1,
                visibility: 'visible'
              });
            video_size_update($vid_wrp, player);
          });
        if(isAutoplay() && curPages.indexOf(page) != -1)
         player.play();
      });
  }
});
