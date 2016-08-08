'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var addNicknameButton = document.getElementById('addNicknameButton');
var editNicknameButton = document.getElementById('editNicknameButton');
var removeNicknameButton = document.getElementById('removeNicknameButton');

var Profile = function () {
  function Profile() {
    _classCallCheck(this, Profile);

    addNicknameButton.addEventListener('click', this.showAddNicknameDialog, false);
    editNicknameButton.addEventListener('click', this.toggleEditNicknameMode, false);
    removeNicknameButton.addEventListener('click', this.toggleRemoveNicknameMode, false);
  }

  _createClass(Profile, [{
    key: 'showAddNicknameDialog',
    value: function showAddNicknameDialog() {}
  }, {
    key: 'toggleEditNicknameMode',
    value: function toggleEditNicknameMode() {}
  }, {
    key: 'toggleRemoveNicknameMode',
    value: function toggleRemoveNicknameMode() {}
  }]);

  return Profile;
}();

new Profile();
//# sourceMappingURL=profile.js.map
