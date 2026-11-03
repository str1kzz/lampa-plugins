/* Печеньки для Lampa, v0.1.0. ES5, без внешних зависимостей. */
(function () {
    'use strict';

    if (window.Pechenki) return;
    var L = window.Lampa;
    if (!L || !L.Listener) return;

    var component = 'pechenki';
    var masterKey = 'pechenki_enabled';
    var features = [];
    var ready = false;
    var icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">' +
        '<path d="M21 12a4 4 0 0 1-5-5 4 4 0 0 1-4-4 9 9 0 1 0 9 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
        '<g fill="currentColor"><circle cx="8" cy="8" r="1.2"/><circle cx="7" cy="14" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="13" cy="17" r="1.2"/></g></svg>';

    function boolean(value) {
        return value === true || value === 'true' || value === 1 || value === '1';
    }

    function escapeHtml(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function find(id) {
        for (var i = 0; i < features.length; i++) {
            if (features[i].id === id) return features[i];
        }
        return null;
    }

    function enabled(id) {
        if (!boolean(L.Storage.get(masterKey, true))) return false;
        if (typeof id === 'undefined') return true;
        var feature = find(id);
        return !!feature && boolean(L.Storage.get(feature.key, feature.defaultEnabled));
    }

    function applyFeature(feature) {
        var next = enabled(feature.id);
        if (next === feature.active) return;
        try {
            if (next) feature.enable();
            else feature.disable();
            feature.active = next;
        }
        catch (error) {
            // A failed feature must not stop the remaining features from updating.
            console.error('[Печеньки] ' + feature.id, error);
            if (next) {
                try { feature.disable(); } catch (cleanupError) {
                    console.error('[Печеньки] cleanup ' + feature.id, cleanupError);
                }
                L.Storage.set(feature.key, false);
            }
            if (L.Noty) L.Noty.show('Печеньки: ошибка функции «' + feature.title + '».');
        }
    }

    function sync() {
        if (!ready) return;
        for (var i = 0; i < features.length; i++) applyFeature(features[i]);
    }

    function addToggle(feature) {
        L.SettingsApi.addParam({
            component: component,
            param: {name: feature.key, type: 'trigger', default: feature.defaultEnabled},
            field: {name: escapeHtml(feature.title), description: escapeHtml(feature.description)},
            onChange: sync
        });
    }

    function registerFeature(definition) {
        if (!definition || !/^[a-z][a-z0-9_]*$/.test(definition.id) ||
            !definition.title || typeof definition.enable !== 'function' ||
            typeof definition.disable !== 'function') {
            throw new Error('Печеньки: нужны id, title, enable и disable.');
        }
        if (find(definition.id)) throw new Error('Печеньки: повторный id ' + definition.id);
        var feature = {
            id: definition.id,
            key: 'pechenki_feature_' + definition.id,
            title: definition.title,
            description: definition.description || '',
            defaultEnabled: boolean(definition.defaultEnabled),
            enable: definition.enable,
            disable: definition.disable,
            active: false
        };
        features.push(feature);
        if (ready) {
            addToggle(feature);
            applyFeature(feature);
        }
    }

    function setEnabled(id, value) {
        var feature = typeof id === 'undefined' ? null : find(id);
        if (typeof id !== 'undefined' && !feature) throw new Error('Печеньки: неизвестная функция ' + id);
        L.Storage.set(feature ? feature.key : masterKey, boolean(value));
        sync();
    }

    function open() {
        // Open the native panel first: Settings.create alone does not show its layer.
        L.Controller.toggle('settings');
        L.Settings.create(component);
    }

    function init() {
        if (ready) return;
        if (!L.SettingsApi || !L.Settings || !L.Storage || !L.Controller) {
            console.error('[Печеньки] Недоступен API настроек Lampa.');
            return;
        }
        L.SettingsApi.addComponent({component: component, name: 'Печеньки', icon: icon});
        L.SettingsApi.addParam({
            component: component,
            param: {name: masterKey, type: 'trigger', default: true},
            field: {
                name: 'Включить наши функции',
                description: 'Общий выключатель. Выбор отдельных функций сохраняется.'
            },
            onChange: sync
        });
        L.SettingsApi.addParam({
            component: component,
            param: {name: 'pechenki_info', type: 'title'},
            field: {
                name: 'Наши настройки',
                description: 'Новые функции и их переключатели будут появляться здесь после обновления «Печенек».'
            }
        });
        for (var i = 0; i < features.length; i++) addToggle(features[i]);

        if (L.Menu && typeof L.Menu.addButton === 'function') {
            L.Menu.addButton(icon, 'Печеньки', open).attr('data-action', 'pechenki');
        }
        else {
            var button = window.$('<li class="menu__item selector" data-action="pechenki">' +
                '<div class="menu__ico">' + icon + '</div><div class="menu__text">Печеньки</div></li>');
            button.on('hover:enter', open);
            window.$('.menu .menu__list').eq(0).append(button);
        }
        ready = true;
        L.Listener.remove('app', onApp);
        sync();
    }

    function onApp(event) {
        if (event.type === 'ready') init();
    }

    window.Pechenki = {
        version: '0.1.0',
        registerFeature: registerFeature,
        isEnabled: enabled,
        setEnabled: setEnabled,
        open: open
    };

    if (window.appready) init();
    else L.Listener.follow('app', onApp);
}());
