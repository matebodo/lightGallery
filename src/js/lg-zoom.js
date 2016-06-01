/*! lightgallery - v1.2.19 - 2016-05-17
* http://sachinchoolur.github.io/lightGallery/
* Copyright (c) 2016 Sachin N; Licensed Apache 2.0 */

/* Forked and rewriten to improve zoom func. and touch support by Kachurin M, 01-06-2016  */

(function($, window, document, undefined) {

    'use strict';

    var defaults = {
        scale: 1,
        zoom: true,
        actualSize: true,
        zoomIcons: true,
        enableZoomAfter: 300
    };

    var Zoom = function(element) {

        this.core = $(element).data('lightGallery');

        this.core.s = $.extend({}, defaults, this.core.s);

        if (this.core.s.zoom && this.core.doCss()) {
            this.init();

            // Store the zoomable timeout value just to clear it while closing
            this.zoomabletimeout = false;

            // Set the initial value center
            this.pageX = $(window).width() / 2;
            this.pageY = ($(window).height() / 2) + $(window).scrollTop();
        }

        if ( !this.core.imageData ) {
            this.core.imageData = {};
        }

        return this;
    };

    Zoom.prototype.init = function() {
        var _this = this;
        var zoomIcons;

        if (_this.core.s.zoomIcons) {
            zoomIcons = '<span id="lg-zoom-in" class="lg-icon"></span><span id="lg-zoom-out" class="lg-icon"></span>';
        }

        if (_this.core.s.actualSize) {
            zoomIcons += '<span id="lg-actual-size" class="lg-icon"></span>';
        }

        this.core.$outer.find('.lg-toolbar').append(zoomIcons);

        // переключение слайда
        _this.core.$el.off('onBeforeSlide.lg.tm.zoom').on('onBeforeSlide.lg.tm.zoom', function(e, prevIndex, index) {
            // сбрасываем зум текущей
            _this.fitImage(prevIndex, true);
        });

        // Когда загружены картинки
        _this.core.$el.on('onSlideItemLoad.lg.tm.zoom', function(event, index, delay) {
            _this.savePosition(index);

            // delay will be 0 except first time
            var _speed = _this.core.s.enableZoomAfter + delay;

            // set _speed value 0 if gallery opened from direct url and if it is first slide
            if ($('body').hasClass('lg-from-hash') && delay) {
                // will execute only once
                _speed = 0;
            } else {
                // Remove lg-from-hash to enable starting animation.
                $('body').removeClass('lg-from-hash');
            }

            _this.zoomabletimeout = setTimeout(function() {
                _this.core.$slide.eq(index).addClass('lg-zoomable');
            }, _speed + 30);
        });

        // двойной щелчок по фото
        _this.core.$slide.on('dblclick', '.lg-image', function(e) {
            _this.actualSize(e);
        });

        // Fingers counter
        var fingers = 0;
        var tapped = false;
        _this.core.$slide.on('touchstart','.lg-image', function(e) {
            e.preventDefault();

            fingers = (e.originalEvent.touches && e.originalEvent.touches.length);

            if (fingers == 1) // zoom on dblclick
            {
                if (!tapped) {
                    tapped = setTimeout(function() {
                        tapped = null;
                    }, 300);
                } else {
                    clearTimeout(tapped);
                    tapped = null;
                    _this.actualSize(e);
                }
            }
        });

        // ресайз
        var resize_t;
        $(window).off('resize.lg_zoom orientationchange.lg_zoom').on('resize.lg_zoom orientationchange.lg_zoom', function() {
            clearTimeout(resize_t);
            resize_t = setTimeout(function() {
                // подгоняем каждое изображение к центру
                for (var index in _this.core.imageData ){
                    _this.fitImage(index, true);
                }
            }, 100);
        });

        // кнопки
        if (_this.core.s.zoomIcons) {
            // иконка зум -
            $('#lg-zoom-out').off('click.lg').on('click.lg', function() {
                var current = _this.core.imageData[_this.core.index];
                var scale = +current.$wrap.attr('data-scale') || 1;
                if (_this.core.$outer.find('.lg-current .lg-image').length) {
                    scale -= 1 || 1;
                    _this.zoom(scale);
                    _this.fitImage();
                }
            });

            // иконка зум+
            $('#lg-zoom-in').off('click.lg').on('click.lg', function() {
                var current = _this.core.imageData[_this.core.index];
                var scale = +current.$wrap.attr('data-scale') || 1;
                if (_this.core.$outer.find('.lg-current .lg-image').length) {
                    scale += 1;
                    _this.zoom(scale);
                    _this.fitImage();
                }
            });
        }

        if (_this.core.s.actualSize) {
            // ориг.размер
            $('#lg-actual-size').off('click.lg').on('click.lg', function(e) {
                _this.actualSize(e, true);
            });
        }

        // инит перемещения и тач событий зума
        if (_this.core.isTouch) {
            _this.zoomPitch();
        } else {
            _this.mouseDrag();
            _this.scrollZoom();
        }
    };

    // перемещение и зум тачем
    Zoom.prototype.zoomPitch = function() {
        var _this = this;

        // инфо о текущем изображении, заполняется при клике на картинку
        var current;

        // координаты точек (пальцев) в начале и процессе перемещения
        var startCoords, endCoords, centerCoords;

        // расстояние между точками
        var initialDistance = 0;
        var currentDistance = 0;

        var scale = 1;

        // касания
        var touches = [];

        var isTouched = false;
        var isPitched = false;

        _this.core.$slide.off('touchstart.lg_zoom_pitch').on('touchstart.lg_zoom_pitch', touchStart_zoompitch);
        _this.core.$slide.off('touchmove.lg_zoom_pitch').on('touchmove.lg_zoom_pitch', touchMove_zoompitch);
        _this.core.$slide.off('touchend.lg_zoom_pitch').on('touchend.lg_zoom_pitch', touchEnd_zoompitch);

        function touchStart_zoompitch(e) {
            //происходит смена слайда
            if (_this.core.isDraging) return;

            // точки на экране
            var _coords = _getCoords(e);

            current = _this.core.imageData[_this.core.index];
            scale = +current.$wrap.attr('data-scale') || current.scale || 1;
            // еще не сработало
            if (!isTouched) {
                isTouched = true;
                // координаты начала перемещения, обрабатываем только первое
                startCoords = _coords[0];
                current = _this.core.imageData[_this.core.index];
            }

            // было касание одним пальцем, а стало двумя
            if ( !isPitched && _coords.length >= 2 ) {
                isPitched = true;
                _this.savePosition();
                startCoords = _getCenterPoint(_coords);
            }

            // уже зумировано, разрешаем перемещение
            if (_this.isZoomed) {
                // if ($(e.target).hasClass('lg-object')) {
                    e.preventDefault();
                // }
            }
            // начальное расстояние между пальцами
            initialDistance = _getDistance(_coords);
        }

        function touchMove_zoompitch(e) {
            //происходит смена слайда
            if (_this.core.isDraging) return;

            e.preventDefault();

            var _coords = _getCoords(e);

            var moveX = 0, moveY = 0;

            var newScale = scale,
                percent;

            endCoords = _coords[0];

            _this.core.$outer.addClass('lg-zoom-dragging lg-no-trans');

            // перемещение и зум
            centerCoords = _getCenterPoint(_coords);

            // расстояние между точками на экране
            currentDistance = _getDistance(_coords);

            // 2 пальца, считаем зум
            if (_coords.length == 2) {
                // разница между начальным и текущим
                var diff = currentDistance - initialDistance;
                // считаем новый зум
                percent = Math.floor(diff*100/_this.core.viewportHeight) * 4; // 2 - множитель, т.е скорость зума
                newScale = scale * parseFloat((100 + percent) / 100);

                // ограничения
                // if ((newScale > current.maxScale || newScale < 1)) {
                //     initialDistance = currentDistance;
                //     scale = newScale;
                // }
            }

            // сдвиг при переносе, если разрешен
            if (_this.isZoomed) {
                moveX = (centerCoords.x - startCoords.x);
                moveY = (centerCoords.y - startCoords.y);
            }

            // применяем если реально что то произошло
            if (scale != newScale || (_this.isZoomed && (moveX || moveY))) {
                _this.zoom(newScale, centerCoords.x, centerCoords.y, moveX, moveY);
            }
        }

        function touchEnd_zoompitch(e) {
            //происходит смена слайда
            if (_this.core.isDraging) return;

            var _coords = _getCoords(e);

            scale = +current.$wrap.attr('data-scale');

            // остался строго один палец, считаем оставшийся палец начальной точкой
            if (_coords.length == 1) {
                startCoords = _coords[0];
                endCoords = _coords[0];

                _this.savePosition();
            }

            //  меньше двух пальцев
            if (_coords.length <= 1) {
                isPitched = false;
            }

            // отпущен последний палец
            if (_coords.length === 0) {
                isTouched = false;

                _this.fitImage();
            }
        }

        // возвращает координаты касаний, в виде массива
        function _getCoords(e) {
            if ( !e.originalEvent.touches ) return false;
            var touches = [];

            for (var t in e.originalEvent.touches) {
                var touch = e.originalEvent.touches[t];

                if (!touch.clientX) continue;

                touches.push({
                    x: touch.clientX,
                    y: touch.clientY
                });
            }
            return touches;
        }

        // центр между несколькими точками на экране
        function _getCenterPoint(points) {
            var x = 0, y = 0;

            points.forEach(function(t) {
                x += t.x;
                y += t.y;
            });

            return {
                x: x/points.length,
                y: y/points.length
            };
        }

        // расстояние между точками
        function _getDistance(points) {
            if (points.length > 1) {
                return Math.sqrt(Math.pow((points[1].x - points[0].x), 2)  + Math.pow((points[1].y - points[0].y), 2));
            } else {
                return 0;
            }
        }
    };

    // перемещение картинки мышкой
    Zoom.prototype.scrollZoom = function() {
        var _this = this;

        var scroll_t;
        _this.core.$slide.off('mousewheel.lg_zoom').on('mousewheel.lg_zoom', function(e) {

            var event = e.originalEvent;
            var current = _this.core.imageData[_this.core.index];
            if (!current) return;
            //происходит смена слайда
            if (_this.core.isDraging) return;

            var scale = +current.$wrap.attr('data-scale') || 1;

            var delta = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail))) / 10 * (scale + 1);
            var newScale = scale + delta;
            var pageX = event.pageX;
            var pageY = event.pageY - $(window).scrollTop();

            if ( newScale > current.maxScale) return;

            _this.zoom(newScale, pageX, pageY);
            _this.savePosition();

            clearTimeout(scroll_t);
            scroll_t = setTimeout(function () {
                _this.fitImage();
            }, 150);

            e.preventDefault();
        });
    };

    Zoom.prototype.mouseDrag = function() {
        var _this = this;
        var startCoords = {};
        var endCoords = {};
        var isDraging = false;

        _this.core.$slide.on('mousedown.lg_zoom', function(e) {
            // execute only on .lg-object
            // var $image = _this.core.$slide.eq(_this.core.index).find('.lg-object');
            var current = _this.core.imageData[_this.core.index];

            if (_this.isZoomed) {
                if ($(e.target).hasClass('lg-object')) {
                    e.preventDefault();
                    startCoords = {
                        x: e.pageX,
                        y: e.pageY
                    };

                    isDraging = true;

                    // ** Fix for webkit cursor issue https://code.google.com/p/chromium/issues/detail?id=26723
                    _this.core.$outer.scrollLeft += 1;
                    _this.core.$outer.scrollLeft -= 1;

                    _this.core.$outer.removeClass('lg-grab').addClass('lg-grabbing');
                }
            }
        });

        $(window).on('mousemove.lg_zoom', function(e) {
            if (isDraging) {
                var current = _this.core.imageData[_this.core.index];
                var offsetX;
                var offsetY;

                endCoords = {
                    x: e.pageX,
                    y: e.pageY
                };

                // reset opacity and transition duration
                _this.core.$outer.addClass('lg-zoom-dragging');

                offsetX = (endCoords.x - startCoords.x);
                offsetY = (endCoords.y - startCoords.y);

                _this.zoom(current.scale, 0, 0, offsetX, offsetY);
            }
        });

        $(window).on('mouseup.lg_zoom', function(e) {
            if (isDraging) {
                isDraging = false;

                _this.fitImage();
            }

            if (_this.core.s.enableDrag || _this.isZoomed) {
                _this.core.$outer.removeClass('lg-grabbing').addClass('lg-grab');
            }
        });
    };

    // -----------------------------------------------------------------------------------------------------------------------------------------------------------
    // функция валидатор положения, работает в строгом, либо не строгом режиме, в нестрогом режиме допускается превышение значений сдвига и масштаба меньше минимальных или максимальных
    Zoom.prototype.checkPosition = function(strict, offsetX, offsetY, scale, index) {
        var _this = this;

        var minX = 0,
            minY = 0,
            maxX,
            maxY;

        if (typeof index == "undefined") index = _this.core.index;
        var current = _this.core.imageData[index];
        if (!current) return;

        // текущий масштаб
        scale = scale || +current.$wrap.attr('data-scale') || 1;

        // нельзя зумить больше оригинала
        if (scale > current.maxScale) {
            scale = current.maxScale;
        }

        // строгий режим - недопустим отрицательный масштаб
        if (strict) {
            if (scale < 1) {
                scale = 1;
            }
        }
        // в нестрогом допустимы погрешности
        else {
            if (scale < 1) {
                scale = 1 - (1 - scale) * 0.2;
                if (scale < 0.5) scale = 0.5;
            }
        }

        // размер изображения в данном масштабе
        var imageWidth = current.width * scale;
        var imageHeight = current.height * scale;

        // можно ли перемещать по осям (если картинка больше чем вьюпорт, значит можно)
        var allowX = imageWidth > _this.core.viewportWidth;
        var allowY = imageHeight > _this.core.viewportHeight;

        // крайние значения размера
        // картинка < вьюпорта
        if ( !allowX ) {
            // центруем посередине экрана
            minX = (_this.core.viewportWidth - imageWidth)/2;
            maxX = minX;
        }
        // картинка в масштабе > вьюпорта, но меньше враппера
        else {
            minX = 0;
            maxX = (_this.core.viewportWidth - imageWidth);
        }

        // картинка < вьюпорта
        if ( !allowY ) {
            // центруем посередине экрана
            minY = (_this.core.viewportHeight - imageHeight)/2;
            maxY = minY;
        }
        // картинка в масштабе > вьюпорта и размером с враппер
        // картинка в масштабе > вьюпорта, но меньше враппера
        else {
            minY = 0;
            maxY = (_this.core.viewportHeight - imageHeight);
        }

        // нестрогий режим, позволяем картинке вылазить за пределы мин и макс
        if ( !strict ) {
            var distanceX, distanceY, delim = 0.05 * scale;
            if (offsetX >= 0) {
                distanceX = (offsetX - minX) * delim;
            } else {
                distanceX = (offsetX - maxX) * delim;
            }

            if (offsetY >= 0) {
                distanceY = (offsetY - minY) * delim;
            } else {
                distanceY = (offsetY - maxY) * delim;
            }

            minX += distanceX;
            maxX += distanceX;
            minY += distanceY;
            maxY += distanceY;
        }

        if (offsetX > minX) {
            offsetX = minX;
        } else if (offsetX < maxX) {
            offsetX = maxX;
        }

        if (offsetY > minY) {
            offsetY = minY;
        } else if (offsetY < maxY) {
            offsetY = maxY;
        }

        return { x: offsetX, y: offsetY, scale: scale };
    };

    // зум до натурального размера изображения
    Zoom.prototype.actualSize = function(event, fromIcon) {
        var _this = this;

        var index = _this.core.index;
        var current = _this.core.imageData[index];
        if ( !current ) return;

        var scale = +current.$wrap.attr('data-scale') || 1;
        var x, y;

        // уже отзумили, возвращаем обратно
        if ( _this.isZoomed ) {
            scale = 1;
        } else {
            scale = current.maxScale;
        }

        if ( !fromIcon ) {
            x = event.pageX || event.originalEvent.targetTouches[0].pageX;
            y = (event.pageY || event.originalEvent.targetTouches[0].pageY) - $(window).scrollTop();
        }

        _this.zoom(scale, x, y);
        _this.savePosition();

        setTimeout(function() {
            if (!_this.core.s.enableDrag && !_this.isZoomed) {
                _this.core.$outer.removeClass('lg-grab lg-grabbing');
            } else {
                _this.core.$outer.removeClass('lg-grabbing').addClass('lg-grab');
            }
        }, 10);
    };

    // Располагает изображение внутри вьюпорта, не позволяет изображению вывалиться за пределы экрана
    Zoom.prototype.fitImage = function(index, initial) {
        var _this = this;

        if (typeof index == "undefined") {
            index = this.core.index;
        }

        // рано, изображения еще нету
        if ( !_this.core.imageData ) return;
        var current = _this.core.imageData[index];
        if (!current) return;

        _this.core.$outer.removeClass('lg-zoom-dragging lg-no-trans');

        var offsetX = current.initialOffsetX;
        var offsetY = current.initialOffsetY;
        var scale = 1;

        // не было спец.ключа, пробуем взять данные из блока
        if ( !initial ) {
            offsetX = +current.$wrap.attr('data-x') || offsetX;
            offsetY = +current.$wrap.attr('data-y') || offsetY;
            scale = +current.$wrap.attr('data-scale') || scale;
        }

        var pos = _this.checkPosition(true, offsetX, offsetY, scale, index);
        _this.setPosition(pos.x, pos.y, pos.scale, index);
        _this.savePosition();

        if (pos.scale <= 1) _this.isInZoom = false;
    };

    // зумит картинку на scale из точки pageX,pageY на ЭКРАНЕ со смещением на moveX, moveY
    // используется в тч для позиционирования
    Zoom.prototype.zoom = function(scale, pageX, pageY, moveX, moveY) {
        var _this = this;
        var current = this.core.imageData[this.core.index];
        if ( !current || !scale ) return;

        var x, y;

        if (scale > current.maxScale) scale = current.maxScale;

        // не переданы координаты, берем центр вьюпорта
        if ( !pageX || !pageY) {
            pageX = _this.core.viewportWidth / 2;
            pageY = _this.core.viewportHeight / 2;
        }

        // преобразуем в координату для сдвига
        // текущий оффсет (с учетом текущего зума) - точка на экране + поправка на начальный оффсет + скролл страницы
        var scaleDiff = scale/current.scale;
        x = current.offsetX + ((current.offsetX - pageX) * (scaleDiff - 1));
        y = current.offsetY + ((current.offsetY - pageY) * (scaleDiff - 1));

        // если картинка при этом должна быть смещена, сдвигаем точку x, y на соотв. сдвиг
        var inMove = (typeof moveX != "undefined" && typeof moveY != "undefined");
        if (inMove) {
            x += moveX * scaleDiff;
            y += moveY * scaleDiff;
        }

        // это реально допустимые координаты
        var pos = _this.checkPosition(false, x, y, scale);
        _this.setPosition(pos.x, pos.y, pos.scale);

        // стиль
        _this.isInZoom = true;
        _this.isZoomed = (pos.scale > 1);
        _this.core.$outer.toggleClass('lg-zoomed', (scale > 1));
        _this.core.$outer.toggleClass('lg-zoom-max', (scale >= current.maxScale));
        _this.core.$slide.removeAttr('style');
    };

    // сохраняет позицию  в данные об изображении и дата аттрибутов
    Zoom.prototype.savePosition = function(index) {
        var _this = this;

        index = (typeof index != "undefined") ? index : this.core.index;
        var current = _this.core.imageData[index];
        if ( !current ) return;

        current.scale = +current.$wrap.attr('data-scale') || 1;
        current.offsetX = +current.$wrap.attr('data-x') || current.initialOffsetX;
        current.offsetY = +current.$wrap.attr('data-y') || current.initialOffsetY;
    };

    // Сбрасывает зум и позиционирование
    Zoom.prototype.resetZoom = function(index) {
        var _this = this;

        index = (typeof index != "undefined") ? index : this.core.index;
        var current = _this.core.imageData[index];
        if ( !current ) return;

        this.core.$outer.removeClass('lg-zoomed');
        this.isZoomed = false;
        this.isInZoom = false;

        this.zoom(1, 0, 0, index);
        this.savePosition(index);
    };

    // позиционирует изображение по x, y, scale
    Zoom.prototype.setPosition = function(x, y, scale, index) {
        var _this = this;
        if (typeof index == "undefined") index = _this.core.index;
        var current = _this.core.imageData[index];
        scale = scale || (current.$wrap.attr('data-scale')) || 1;
        x = Math.floor(x) || 0;
        y = Math.floor(y) || 0;

        current.$wrap
        .css({
            transform: 'translate3d(' + x + 'px, ' + y + 'px, 0) scale('+ scale +')'
        }).attr('data-x', x).attr('data-y', y).attr('data-scale', scale);
    };

    Zoom.prototype.destroy = function() {

        var _this = this;

        // Unbind all events added by lightGallery zoom plugin
        _this.core.$el.off('.lg_zoom');
        $(window).off('.lg_zoom');
        _this.core.$slide.off('.lg_zoom');
        _this.core.$el.off('.lg.tm.zoom');
        _this.resetZoom();
        clearTimeout(_this.zoomabletimeout);
        _this.zoomabletimeout = false;
    };
    setTimeout(
        function() {
            $.fn.lightGallery.modules.zoom = Zoom;
        },
        300
    );

})(jQuery, window, document);
