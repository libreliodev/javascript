$(function(){
  var video_exts = [ '.mov', '.mp4', '.flv', '.ogv' ],
  video_extension_types = {
    '.mov': 'video/mp4',
    '.mp4': 'video/mp4',
    '.ogv': 'video/ogg'
  },
  max_icons_size = 100,
  pdf_viewer = $('.pdfviewer');
  function video_size_update($vid_wrp, player)
  {
    var width, size;
    if(player.isFullscreen())
      width = $(window).width();
    else
      width = player.width();
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
       file_ext = path.extname(url('path', url_str));
       // video file
       if(video_exts.indexOf(file_ext.toLowerCase()) != -1)
       {
         var query = querystring.parse(url('?', url_str)),
         qm_idx = url_str.indexOf('?'),
         src = qm_idx == -1 ? url_str : url_str.substring(0, qm_idx),
         type = video_extension_types[file_ext],
         $vid_wrp = $('<div/>'),
         $vid = $('<video class="video-js vjs-default-skin" controls ' +
                         'poster="">' +
                      '<source/>' +
                      '<p class="vjs-no-js">To view this video please enable JavaScript, and consider upgrading to a web browser that <a href="http://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a></p>' +
                    '</video>'),
         $source = $vid.find('source'),
         rect = data.rect,
         releaser = [],
         player, exit_proc;
         $source.attr('src', src);
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
         ('mousedown', false)
         ('mouseup', false);
         on(pdf_viewer, releaser, 'pagecurl-start', function()
           {
             $vid_wrp.animate({ opacity: 0 }, {
               queue: false,
               duration: 200
             });
           })
         ('pagecurl-end', function()
           {
             $vid_wrp.animate({ opacity: 1 }, {
               queue: false,
               duration: 200
             });
           })
         ('curPages-changed', function(ev, curPages)
          {
            if(curPages.indexOf(page) != -1)
            {
             if(player && query.waplay == 'auto')
               player.play();
              return;
            }
            exit_proc = true;
            if(player)
            {
              player.pause();
              player.dispose();
            }
            $vid_wrp.remove();
            funcListCall(releaser);
          });
         data.element = $vid_wrp[0];
         
         videojs($vid[0], {}, function()
           {
             player = this;
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
             player.on('play', function()
               {
                 pdf_viewer.pdfviewer('set', 'auto_resizable', false);
                 if(query.warect == 'full' && !player.isFullscreen())
                   player.requestFullscreen();
               })
               .on('fullscreenchange', function()
                 {
                   video_size_update($vid_wrp, player);
                 });
             if(query.waplay == 'auto' && curPages.indexOf(page) != -1)
               player.play();
           });
       }
     })
});
