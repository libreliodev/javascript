$(function(){

  /*var canvas = $('canvas')[0],
  img = new Image();
  img.src = 'assets/img/background.png';
  var img2 = new Image();
  img2.src = 'assets/img/logo.png';
  var mpagecurl = new PageCurl({
    canvas: canvas,
    grabbable: true,
    corner_epsilon_x: 50,
    corner_epsilon_y: 50,
    rect: [ 100, 150, $(window).width()/2-100, $(window).height()/2-100 ],
    corners: [ 'tl', 'bl', ],
    limits: [ 'tr', 'br' ],
    src0: {image: img2},
    src1: {image: img},
    src2: {image: img2},
    clear_canvas: true
  });
  setTimeout(function(){mpagecurl.render();}, 50);
  /*mpagecurl.destroy();*/
  /*$(document).on('mousemove', function(ev)
    {
      var x = ev.pageX,
      y = ev.pageY;
      var ctx = canvas.getContext('2d');
      side = 'tl',
      rect = [ 150, 150, $(window).width()/2-100, $(window).height()/2-100 ];
      try {
        if(!PageCurl.flip_page_restricted(rect, side, [x,y], ['br','tr']))
        {
          ctx.clearRect(0, 0, canvas.width, canvas.height),
          PageCurl.render_page(ctx, rect, 
                          {image:img}, {image: img}, {image:img2}, side, [x, y]);
        }
      }catch(e) { console.error(e); }
    });*/
  /*setTimeout(function(){
    var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var rect = [ 150, 150, $(window).width()/2-100, $(window).height()/2-100 ];
    pivot = [ rect[0] + rect[2]*2, rect[1] ];
  PageCurl.render_page(ctx, rect, 
                       {image:img}, {image: img}, {image:img2}, 'tl', pivot);
},50);*/
});
