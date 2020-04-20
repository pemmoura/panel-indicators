/* Panel Indicators GNOME Shell extension
 *
 * Copyright (C) 2019 Leandro Vital <leavitals@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const { St, Gtk, GLib, Clutter, Gio } = imports.gi;
const Lang = imports.lang;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext.domain("panel-indicators");
const _ = Gettext.gettext;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const CustomButton = Extension.imports.indicators.button.CustomButton;

var CalendarIndicator = new Lang.Class({
    Name: "CalendarIndicator",
    Extends: CustomButton,
    _init: function () {
        this.parent("CalendarIndicator");

        this._clock = Main.panel.statusArea.dateMenu._clock;
        this._calendar = Main.panel.statusArea.dateMenu._calendar;
        this._date = Main.panel.statusArea.dateMenu._date;
        this._clocksSection = Main.panel.statusArea.dateMenu._clocksItem;
        this._weatherSection = Main.panel.statusArea.dateMenu._weatherItem;
        this._clockIndicator = Main.panel.statusArea.dateMenu._clockDisplay;

        this._clockIndicatorFormat = new St.Label({
            visible: false,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._indicatorParent = this._clockIndicator.get_parent();
        this._calendarParent = this._calendar.get_parent();
        this._sectionParent = this._clocksSection.get_parent();

        this._indicatorParent.remove_actor(this._clockIndicator);
        this._calendarParent.remove_child(this._calendar);
        this._calendarParent.remove_child(this._date);
        this._sectionParent.remove_child(this._clocksSection);
        this._sectionParent.remove_child(this._weatherSection);

        this.box.add_actor(this._clockIndicator);
        this.box.add_actor(this._clockIndicatorFormat);

        let boxLayout;
        let hbox;
        let vbox;

        hbox = new St.BoxLayout({ name: 'calendarArea' });

        boxLayout = new imports.ui.dateMenu.CalendarColumnLayout(this._calendar);
        vbox = new St.Widget({
            style_class: "datemenu-calendar-column",
            layout_manager: boxLayout,
            width: 332
        });
        boxLayout.hookup_style(vbox);

        hbox.add_actor(vbox);

        // MESSAGE
        this._messageList = new imports.ui.calendar.CalendarMessageList();
        this._eventSource = new imports.ui.calendar.DBusEventSource();

        this._calendar.setEventSource(this._eventSource);

        this._messageList._clearButton.destroy();
        this._messageList.setEventSource(this._eventSource);

        //Remove the notification part of the calendar
        this._messageList._sectionList.remove_actor(this._messageList._notificationSection);
        this._messageList._sectionList.remove_actor(this._messageList._eventsSection);
        this._messageList._sectionList.remove_actor(this._messageList._mediaSection);
        this._messageList._sync();

        let otherFile = Gio.File.new_for_uri('resource:///org/gnome/shell/theme/no-events.svg');
        this._otherIcon = new Gio.FileIcon({ file: otherFile });
        this._otherLabel = _("No Events");

        this._messageList._placeholder._icon.gicon = this._otherIcon;
        this._messageList._placeholder._label.text = this._otherLabel;

        hbox.add_child(this._messageList);

        vbox.add_actor(this._date);
        vbox.add_actor(this._calendar);

        this._scrollView = new St.ScrollView({
            overlay_scrollbars: true,
            x_expand: true,
            y_expand: true,
            
        });
        this._scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._scrollView.set_style('height: 116px;');

        let scrollableContainer = new St.BoxLayout({
            vertical: true,
            reactive: true,
            x_expand: true,
            y_expand: true,
        });
        scrollableContainer.add_actor(this._clocksSection);
        
        this._scrollView.add_actor(scrollableContainer);

        vbox.add_actor(this._scrollView);
        vbox.add_actor(this._weatherSection);

        this.menu.box.add(hbox);

        this.menu_size(hbox);

        this._separator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._separator);

        this._settings = new PopupMenu.PopupMenuItem(_("Date Time Settings"));
        this._settings.connect("activate", () => this._openApp("gnome-datetime-panel.desktop"));
        this.menu.addMenuItem(this._settings);

        this.menu.connect("open-state-changed", (menu, isOpen) => {
            if (isOpen) {
                let now = new Date();

                this._date.setDate(now);
                this._calendar.setDate(now);
                Main.panel.statusArea.dateMenu._messageList.setDate(now);

                this.menu_size(hbox);
            }
        });

        this._date_changed = this._calendar.connect("selected-date-changed", (calendar, date) => {
            // Main.panel.statusArea.dateMenu._messageList.setDate(now);
            this._messageList._placeholder._icon.gicon = this._otherIcon;
            this._messageList._placeholder._label.text = this._otherLabel;
        });
    },
    menu_size: function (hbox) {

        var menuHeight = 356;

        var clocksSectionHeight = this._clocksSection.get_height();
 
        if (this._clocksSection._clocksApp != null) {
            clocksSectionHeight.length > 0 ? menuHeight += clocksSectionHeight : menuHeight += 120;
            this._scrollView.actor.show();
            this._clocksSection.actor.set_style('padding-left: 12px; padding-right: 20px;');
        } else {
            this._scrollView.hide();
        }

        if (this._weatherSection._weatherClient.available) {
            menuHeight += this._weatherSection.actor.get_height();
        }

        hbox.set_height(menuHeight);

    },
    override: function (format) {
        this.resetFormat();
        if (format == "") {
            return
        }
        let that = this;
        this._formatChanged = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            that.changeFormat();
            return true;
        });
        this._clockIndicator.hide();
        this._clockIndicatorFormat.show();
        this._dateFormat = format;
        this.changeFormat();
    },
    changeFormat: function () {
        if (this._dateFormat && this._dateFormat != "") {
            let date = new Date();
            this._clockIndicatorFormat.set_text(date.toLocaleFormat(this._dateFormat));
        }
    },
    resetFormat: function () {
        if (this._formatChanged) {
            GLib.source_remove(this._formatChanged);
            this._formatChanged = null;
        }
        this._clockIndicator.show();
        this._clockIndicatorFormat.hide();
    },
    destroy: function () {
        this.resetFormat();
        this._calendar.disconnect(this._date_changed);
        
        this.box.remove_child(this._clockIndicator);

        this._date.actor.get_parent().remove_child(this._date.actor);
        this._calendar.actor.get_parent().remove_child(this._calendar.actor);
        this._clocksSection.actor.get_parent().remove_child(this._clocksSection.actor);
        this._weatherSection.actor.get_parent().remove_child(this._weatherSection.actor);
      
        this._calendarParent.add_child(this._date.actor);
        this._sectionParent.add_child(this._clocksSection.actor);
        this._sectionParent.add_child(this._weatherSection.actor);
        this._calendarParent.add_child(this._calendar.actor);

        this._indicatorParent.add_actor(this._clockIndicator);

        this.parent();
    }
});
