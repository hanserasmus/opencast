/**
 * Licensed to The Apereo Foundation under one or more contributor license
 * agreements. See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 *
 * The Apereo Foundation licenses this file to you under the Educational
 * Community License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License
 * at:
 *
 *   http://opensource.org/licenses/ecl2.txt
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 */
'use strict';

angular.module('adminNg.resources')
.factory('SignatureResource', ['$resource', function ($resource) {
    var transformRequest = function (data) {
        var request = {};
        request.username = data.username;
        request.from_name = request.reply_name = data.name;
        request.from_address = data.replyAddress = data.sender.address;
        request.text = data.signature;
        request.name = data.name;
        return $.param(request);
    };

    return $resource('/admin-ng/user-settings/signature/:id', {id: '@id'}, {
        get: {
            method: 'GET',
            transformResponse: function (data) {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    return {
                        replyTo: {},
                        existsOnServer: false
                    };
                }
                data.existsOnServer = true;
                return data;
            }
        },
        update: {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            params: {
                id: '@id'
            },
            transformRequest: transformRequest
        },
        save: {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            transformRequest: transformRequest
        }
    });
}]);
