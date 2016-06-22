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

// Controller for all event screens.
angular.module('adminNg.controllers')
.controller('EventCtrl', [
    '$scope', 'Notifications', 'EventTransactionResource', 'EventMetadataResource', 'EventAssetsResource',
    'EventCatalogsResource', 'CommentResource', 'EventWorkflowsResource',
    'ResourcesListResource', 'EventAccessResource', 'EventGeneralResource',
    'OptoutsResource', 'EventParticipationResource', 'NewEventProcessingResource', 
    'OptoutSingleResource', 'CaptureAgentsResource', 'ConflictCheckResource', 'Language', 'JsHelper', '$sce', '$timeout',
    function ($scope, Notifications, EventTransactionResource, EventMetadataResource, EventAssetsResource, EventCatalogsResource, CommentResource,
        EventWorkflowsResource, ResourcesListResource, EventAccessResource, EventGeneralResource,
        OptoutsResource, EventParticipationResource, NewEventProcessingResource,
        OptoutSingleResource, CaptureAgentsResource, ConflictCheckResource, Language, JsHelper, $sce, $timeout) {

        var saveFns = {},
            me = this,
            NOTIFICATION_CONTEXT = 'events-access',
            SCHEDULING_CONTEXT = 'event-scheduling',
            mainCatalog = 'dublincore/episode',
            idConfigElement = '#event-workflow-configuration',
            workflowConfigEl = angular.element(idConfigElement),
            baseWorkflow,
            createPolicy = function (role) {
                return {
                    role  : role,
                    read  : false,
                    write : false,
                    actions : {
                        name : 'event-acl-actions',
                        value : []
                    }
                };
            },
            findWorkflow = function (id) {
                var workflow;

                angular.forEach($scope.workflowDefinitions, function (w) {
                    if (w.id === id) {
                        workflow = w;
                    }
                });

                if (!angular.isDefined(workflow)) {
                    return baseWorkflow;
                } else {
                    return workflow;
                }

            },
            addChangeDetectionToInputs = function () {
                var element, isRendered = angular.element(idConfigElement).find('.configField').length > 0;
                if (!angular.isDefined($scope.workflows.workflow.configuration_panel) || !$scope.workflows.workflow.configuration_panel.trim()) {
                    // The workflow contains no configuration (it is empty), therefore it is rendered.
                    isRendered = true;
                }
                if (!isRendered) {
                    $timeout(addChangeDetectionToInputs, 200);
                    return;
                } else {
                    element = angular.element(idConfigElement).find('.configField');
                }

                element.each(function (idx, el) {
                    var element = angular.element(el);

                    if (angular.isDefined(element.attr('id'))) {
                        element.change($scope.saveWorkflowConfig);
                    }
                });
            },
            updateConfigurationPanel = function (html) {
                if (angular.isUndefined(html)) {
                    html = undefined;
                }
                $scope.workflowConfiguration = $sce.trustAsHtml(html);
                addChangeDetectionToInputs();
            },
            // Get the workflow configuration
            getWorkflowConfig = function () {
                var workflowConfig = {}, element, isRendered = angular.element(idConfigElement).find('.configField').length > 0;

                if (!angular.isDefined($scope.workflows.workflow.configuration_panel) || !$scope.workflows.workflow.configuration_panel.trim()) {
                    // The workflow contains no configuration (it is empty), therefore it is rendered.
                    isRendered = true;
                }

                if (!isRendered) {
                    element = angular.element($scope.workflows.workflow.configuration_panel).find('.configField');
                } else {
                    element = angular.element(idConfigElement).find('.configField');
                }

                element.each(function (idx, el) {
                    var element = angular.element(el);

                    if (angular.isDefined(element.attr('id'))) {
                        if (element.is('[type=checkbox]') || element.is('[type=radio]')) {
                            workflowConfig[element.attr('id')] = element.is(':checked') ? 'true' : 'false';
                        } else {
                            workflowConfig[element.attr('id')] = element.val();
                        }
                    }
                });

                return workflowConfig;
            },
            setWorkflowConfig = function () {
                var isRendered = angular.element(idConfigElement).find('.configField').length > 0;

                if (!angular.isDefined($scope.workflows.workflow.configuration_panel) || !$scope.workflows.workflow.configuration_panel.trim()) {
                    // The workflow contains no configuration (it is empty), therefore it is rendered.
                    isRendered = true;
                }

                if (!isRendered) {
                    $timeout(setWorkflowConfig, 200);
                } else {
                    angular.forEach(baseWorkflow.configuration, function (value, key) {
                        var el = angular.element(idConfigElement).find('#' + key + '.configField');

                        if (el.length > 0) {
                            if (el.is('[type=checkbox]') || el.is('[type=radio]')) {
                                if (value === 'true' || value === true) {
                                    el.attr('checked','checked');
                                }
                            } else {
                                el.val(value);
                            }
                        }

                    });
                    me.loadingWorkflow = false;
                }
            },
            changePolicies = function (access, loading) {
                var newPolicies = {};
                angular.forEach(access, function (acl) {
                    var policy = newPolicies[acl.role];

                    if (angular.isUndefined(policy)) {
                        newPolicies[acl.role] = createPolicy(acl.role);
                    }
                    if (acl.action === 'read' || acl.action === 'write') {
                        newPolicies[acl.role][acl.action] = acl.allow;
                    } else if (acl.allow === true || acl.allow === 'true'){
                        newPolicies[acl.role].actions.value.push(acl.action);
                    }
                });

                $scope.policies = [];
                angular.forEach(newPolicies, function (policy) {
                    $scope.policies.push(policy);
                });

                if (!loading) {
                    $scope.accessSave();
                }
            },
            checkForActiveTransactions = function () {
                EventTransactionResource.hasActiveTransaction({id: $scope.resourceId }, function (data) {
                    $scope.transactions.read_only = angular.isUndefined(data.hasActiveTransaction) ? true : data.hasActiveTransaction;
                });

                $scope.checkForActiveTransactionsTimer = $timeout(checkForActiveTransactions, 3000);
            },
            fetchChildResources = function (id) {
                $scope.general        = EventGeneralResource.get({ id: id }, function () {
                    angular.forEach($scope.general.publications, function (publication) {
                        publication.label = publication.name;
                    });
                    $scope.publicationChannelLabels = ResourcesListResource.get({ resource: 'PUBLICATION.CHANNEL.LABELS' }, function() {
                        angular.forEach($scope.general.publications, function (publication) {
                            if(angular.isDefined($scope.publicationChannelLabels[publication.id])) {
                                publication.label = $scope.publicationChannelLabels[publication.id];
                            }
                        });
                    });
                    $scope.publicationChannelIcons = ResourcesListResource.get({ resource: 'PUBLICATION.CHANNEL.ICONS' }, function() {
                        angular.forEach($scope.general.publications, function (publication) {
                            if(angular.isDefined($scope.publicationChannelIcons[publication.id])) {
                                publication.icon = $scope.publicationChannelIcons[publication.id];
                            }
                        });
                    });
                });

                $scope.metadata =  EventMetadataResource.get({ id: id }, function (metadata) {
                    var episodeCatalogIndex;
                    angular.forEach(metadata.entries, function (catalog, index) {
                        if (catalog.flavor === mainCatalog) {
                            $scope.episodeCatalog = catalog;
                            episodeCatalogIndex = index;
                            var keepGoing = true;
                            angular.forEach(catalog.fields, function (entry) {
                                if (entry.id === 'title' && angular.isString(entry.value)) {
                                    $scope.titleParams = { resourceId: entry.value.substring(0,70) };
                                }
                                if (keepGoing && entry.locked) {
                                    metadata.locked = entry.locked;
                                    keepGoing = false;
                                }
                            });
                        }
                    });

                    if (angular.isDefined(episodeCatalogIndex)) {
                        metadata.entries.splice(episodeCatalogIndex, 1);
                    }
                });

                $scope.acls = ResourcesListResource.get({ resource: 'ACL' });
                $scope.actions = {};
                $scope.hasActions = false;
                ResourcesListResource.get({ resource: 'ACL.ACTIONS'}, function(data) {
                    angular.forEach(data, function (value, key) {
                        if (key.charAt(0) !== '$') {
                            $scope.actions[key] = value;
                            $scope.hasActions = true;
                        }
                    });
                });
                $scope.roles = ResourcesListResource.get({ resource: 'ROLES' });

                $scope.assets = EventAssetsResource.get({ id: id });

                $scope.participation = EventParticipationResource.get({ id: id }, function (data) {
                    if (data.read_only) {
                        $scope.lastNotificationId = Notifications.add('warning', 'EVENT_PARTICIPATION_STATUS_READONLY', 'event-scheduling', -1);
                    }
                });

                $scope.workflow = {};
                $scope.workflows = EventWorkflowsResource.get({ id: id }, function () {
                    if (angular.isDefined($scope.workflows.workflow)) {
                        baseWorkflow = $scope.workflows.workflow;
                        $scope.workflow.id = $scope.workflows.workflow.workflowId;
                        $scope.workflowDefinitions = NewEventProcessingResource.get({
                            tags: 'schedule-ng'
                        }, function () {
                            $scope.changeWorkflow(true);
                            setWorkflowConfig();
                        });
                    }
                });

                $scope.access = EventAccessResource.get({ id: id }, function (data) {
                    if (angular.isDefined(data.episode_access)) {
                        var json = angular.fromJson(data.episode_access.acl);
                        changePolicies(json.acl.ace, true);
                    }
                });
                $scope.comments = CommentResource.query({ resource: 'event', resourceId: id, type: 'comments' });
            },
            tzOffset = (new Date()).getTimezoneOffset() / -60;

        /**
         * <===============================
         * START Scheduling related resources
         */

        /* Get the current client timezone */
        $scope.tz = 'UTC' + (tzOffset < 0 ? '-' : '+') + tzOffset;

        $scope.scheduling = {};
        $scope.sortedWeekdays = JsHelper.getWeekDays();
        $scope.hours = JsHelper.initArray(24);
        $scope.minutes = JsHelper.initArray(60);

        this.conflicts = [];
        this.readyToPollConflicts = function () {
            var data = $scope.source, result;
            result = angular.isDefined(data) && angular.isDefined(data.start) &&
                angular.isDefined(data.start.date) && data.start.date.length > 0 &&
                angular.isDefined(data.device) &&
                angular.isDefined(data.device.id) && data.device.id.length > 0;

            return result;
        };

        this.noConflictsDetected = function () {
            while (me.conflicts.length > 0) {
                me.conflicts.pop();
            }
            me.checkingConflicts = false;
        };

        this.conflictsDetected = function (response) {
            if (response.status === 409) {
                if (me.notification) {
                    Notifications.remove(me.notification, SCHEDULING_CONTEXT);
                }
                me.conflicts = []; // reset
                me.notification = Notifications.add('error', 'CONFLICT_DETECTED', SCHEDULING_CONTEXT);
                var data = response.data;
                angular.forEach(data, function (d) {
                    me.conflicts.push({
                        title: d.title,
                        start: Language.toLocalTime(d.start.substr(6, d.start.length)),
                        end: Language.toLocalTime(d.end.substr(5, d.end.length))
                    });
                });
            }
            me.checkingConflicts = false;
        };

        $scope.checkConflicts = function () {
            me.checkingConflicts = true;
            if (me.readyToPollConflicts()) {
                ConflictCheckResource.check($scope.source, me.noConflictsDetected, me.conflictsDetected);
            } else {
                me.checkingConflicts = false;
            }
        };

        $scope.saveScheduling = function () {
            if (me.readyToPollConflicts()) {
                ConflictCheckResource.check($scope.source, function () {
                    while (me.conflicts.length > 0) {
                        me.conflicts.pop();
                    }

                    $scope.source.agentId = $scope.source.device.id;
                    $scope.source.agentConfiguration['capture.device.names'] = '';

                    angular.forEach($scope.source.device.inputMethods, function (value, key) {
                        if (value) {
                            if ($scope.source.agentConfiguration['capture.device.names'] !== '') {
                                $scope.source.agentConfiguration['capture.device.names'] += ',';
                            }
                            $scope.source.agentConfiguration['capture.device.names'] += key;
                        }
                    });
                }, me.conflictsDetected);
            }
        };

        /**
         * End Scheduling related resources
         * ===============================>
         */

        $scope.policies = [];
        $scope.baseAcl = {};

        $scope.changeBaseAcl = function () {
            $scope.baseAcl = EventAccessResource.getManagedAcl({id: this.baseAclId}, function () {
                changePolicies($scope.baseAcl.acl.ace);
            });
            this.baseAclId = '';
        };

        $scope.addPolicy = function () {
            $scope.policies.push(createPolicy());
        };

        $scope.deletePolicy = function (policyToDelete) {
            var index;

            angular.forEach($scope.policies, function (policy, idx) {
                if (policy.role === policyToDelete.role &&
                    policy.write === policyToDelete.write &&
                    policy.read === policyToDelete.read) {
                    index = idx;
                }
            });

            if (angular.isDefined(index)) {
                $scope.policies.splice(index, 1);
            }

            $scope.accessSave();
        };

        $scope.getPreview = function (url) {
            return [{
                uri: url
            }];
        };

        $scope.updateOptout = function (newBoolean) {

            OptoutSingleResource.save({
                resource: 'event',
                id: $scope.resourceId,
                optout: newBoolean
            }, function () {
                Notifications.add('success', 'EVENT_PARTICIPATION_STATUS_UPDATE_SUCCESS', 'event-scheduling');
            }, function () {
                Notifications.add('error', 'EVENT_PARTICIPATION_STATUS_UPDATE_ERROR', 'event-scheduling');
            });

        };

        me.loadingWorkflow = true;

        // Listener for the workflow selection
        $scope.changeWorkflow = function (noSave) {
            // Skip the changing workflow call if the view is not loaded
            if (me.loadingWorkflow && !noSave) {
                return;
            }

            me.changingWorkflow = true;
            workflowConfigEl = angular.element(idConfigElement);
            if (angular.isDefined($scope.workflow.id)) {
                $scope.workflows.workflow = findWorkflow($scope.workflow.id);
                updateConfigurationPanel($scope.workflows.workflow.configuration_panel);
            } else {
                updateConfigurationPanel();
            }

            if (!noSave) {
                $scope.saveWorkflowConfig();
            }
            me.changingWorkflow = false;
        };

        $scope.saveWorkflowConfig = function () {
            EventWorkflowsResource.save({
                id: $scope.resourceId,
                entries: {
                    id: $scope.workflows.workflow.id,
                    configuration: getWorkflowConfig()
                }
            }, function () {
                baseWorkflow = {
                    workflowId: $scope.workflows.workflow.id,
                    configuration: getWorkflowConfig()
                };
            });
        };

        $scope.replyToId = null; // the id of the comment to which the user wants to reply
        $scope.title = $scope.resourceId; // if nothing else use the resourceId

        fetchChildResources($scope.resourceId);

        $scope.$on('change', function (event, id) {
            fetchChildResources(id);
        });

        $scope.transactions = {
            read_only: false
        };

        // Generate proxy function for the save metadata function based on the given flavor
        // Do not generate it
        $scope.getSaveFunction = function (flavor) {
            var fn = saveFns[flavor],
                catalog;

            if (angular.isUndefined(fn)) {
                if ($scope.episodeCatalog.flavor === flavor) {
                    catalog = $scope.episodeCatalog;
                } else {
                    angular.forEach($scope.metadata.entries, function (c) {
                        if (flavor === c.flavor) {
                            catalog = c;
                        }
                    });
                }

                fn = function (id, callback) {
                    $scope.metadataSave(id, callback, catalog);
                };

                saveFns[flavor] = fn;
            }
            return fn;
        };

        $scope.metadataSave = function (id, callback, catalog) {
            catalog.attributeToSend = id;

            EventMetadataResource.save({ id: $scope.resourceId }, catalog,  function () {
                if (angular.isDefined(callback)) {
                    callback();
                }

                // Mark the saved attribute as saved
                angular.forEach(catalog.fields, function (entry) {
                    if (entry.id === id) {
                        entry.saved = true;
                    }
                });
            });
        };

        $scope.components = ResourcesListResource.get({ resource: 'components' });

        $scope.myComment = {};

        $scope.replyTo = function (comment) {
            $scope.replyToId = comment.id;
            $scope.originalComment = comment;
            $scope.myComment.resolved = false;
        };

        $scope.exitReplyMode = function () {
            $scope.replyToId = null;
            $scope.myComment.text = '';
        };

        $scope.comment = function () {
        	$scope.myComment.saving = true;
            CommentResource.save({ resource: 'event', resourceId: $scope.resourceId, type: 'comment' },
                { text: $scope.myComment.text, reason: $scope.myComment.reason },
                function () {
                	$scope.myComment.saving = false;
                	$scope.myComment.text = '';

                    $scope.comments = CommentResource.query({
                        resource: 'event',
                        resourceId: $scope.resourceId,
                        type: 'comments'
                    });
                }, function () {
                	$scope.myComment.saving = false;
                }
            );
        };

        $scope.reply = function () {
        	$scope.myComment.saving = true;
            CommentResource.save({ resource: 'event', resourceId: $scope.resourceId, id: $scope.replyToId, type: 'comment', reply: 'reply' },
                { text: $scope.myComment.text, resolved: $scope.myComment.resolved },
                function () {
                	$scope.myComment.saving = false;
                	$scope.myComment.text = '';

                    $scope.comments = CommentResource.query({
                        resource: 'event',
                        resourceId: $scope.resourceId,
                        type: 'comments'
                    });
                }, function () {
                	$scope.myComment.saving = false;
                }

            );
            $scope.exitReplyMode();
        };

        this.accessSaved = function () {
          Notifications.add('info', 'SAVED_ACL_RULES', NOTIFICATION_CONTEXT, 5000);
        };

        this.accessNotSaved = function () {
          Notifications.add('error', 'ACL_NOT_SAVED', NOTIFICATION_CONTEXT, 30000);
          
          $scope.access = EventAccessResource.get({ id: $scope.resourceId }, function (data) {
              if (angular.isDefined(data.episode_access)) {
                  var json = angular.fromJson(data.episode_access.acl);
                  changePolicies(json.acl.ace, true);
              }
          });          
        };

        $scope.accessSave = function () {
            var ace = [],
                hasRights = false,
                rulesValid = false;

            angular.forEach($scope.policies, function (policy) {
                rulesValid = false;

                if (policy.read && policy.write) {
                    hasRights = true;
                }

                if ((policy.read || policy.write || policy.actions.value.length > 0) && !angular.isUndefined(policy.role)) {
                    rulesValid = true;

                    if (policy.read) {
                        ace.push({
                            'action' : 'read',
                            'allow'  : policy.read,
                            'role'   : policy.role
                        });
                    }

                    if (policy.write) {
                        ace.push({
                            'action' : 'write',
                            'allow'  : policy.write,
                            'role'   : policy.role
                        });
                    }

                    angular.forEach(policy.actions.value, function(customAction){
                           ace.push({
                                'action' : customAction,
                                'allow'  : true,
                                'role'   : policy.role
                           });
                    });
                }
            });

            me.unvalidRule = !rulesValid;
            me.hasRights = hasRights;

            if (me.unvalidRule) {
                if (!angular.isUndefined(me.notificationRules)) {
                    Notifications.remove(me.notificationRules, NOTIFICATION_CONTEXT);
                }
                me.notificationRules = Notifications.add('warning', 'INVALID_ACL_RULES', NOTIFICATION_CONTEXT);
            } else if (!angular.isUndefined(me.notificationRules)) {
                Notifications.remove(me.notificationRules, NOTIFICATION_CONTEXT);
                me.notificationRules = undefined;
            }

            if (!me.hasRights) {
                if (!angular.isUndefined(me.notificationRights)) {
                    Notifications.remove(me.notificationRights, NOTIFICATION_CONTEXT);
                }
                me.notificationRights = Notifications.add('warning', 'MISSING_ACL_RULES', NOTIFICATION_CONTEXT);
            } else if (!angular.isUndefined(me.notificationRights)) {
                Notifications.remove(me.notificationRights, NOTIFICATION_CONTEXT);
                me.notificationRights = undefined;
            }

            if (hasRights && rulesValid) {
                EventAccessResource.save({id: $scope.resourceId}, {
                    acl: {
                        ace: ace
                    },
                    override: true
                }, me.accessSaved, me.accessNotSaved);                
            }
        };

        $scope.severityColor = function (severity) {
            switch (severity.toUpperCase()) {
                case 'FAILURE':
                    return 'red';
                case 'INFO':
                    return 'green';
                case 'WARNING':
                    return 'yellow';
            }
        };

        $scope.deleteComment = function (id) {
            CommentResource.delete(
                { resource: 'event', resourceId: $scope.resourceId, id: id, type: 'comment' },
                function () {
                    $scope.comments = CommentResource.query({
                        resource: 'event',
                        resourceId: $scope.resourceId,
                        type: 'comments'
                    });
                }
            );
        };

        $scope.deleteCommentReply = function (commentId, reply) {
            CommentResource.delete(
                { resource: 'event', resourceId: $scope.resourceId, type: 'comment', id: commentId, reply: reply },
                function () {
                    $scope.comments = CommentResource.query({
                        resource: 'event',
                        resourceId: $scope.resourceId,
                        type: 'comments'
                    });
                }
            );
        };

        $scope.modal_close = $scope.close;
        // CERV-1048 override default close of the modal to stop checking for active transactions.
        $scope.close = function () {
            $timeout.cancel($scope.checkForActiveTransactionsTimer);
            if ($scope.lastNotificationId) {
                Notifications.remove($scope.lastNotificationId, 'event-scheduling');
                $scope.lastNotificationId = undefined;
            }
            $scope.modal_close();
        };

        checkForActiveTransactions();
    }
]);