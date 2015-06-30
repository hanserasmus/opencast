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

package org.opencastproject.serviceregistry.api;

/**
 * Exception that is thrown during service lookups.
 */
public class ServiceUnavailableException extends Exception {

  /** Serial version UID */
  private static final long serialVersionUID = -5986792578531437980L;

  /**
   * Creates a new service unavailable exception.
   *
   * @param message
   *          the error message
   * @param t
   *          the exception causing the error
   */
  public ServiceUnavailableException(String message, Throwable t) {
    super(message, t);
  }

  /**
   * Creates a new service unavailable exception.
   *
   * @param message
   *          the error message
   */
  public ServiceUnavailableException(String message) {
    super(message);
  }

  /**
   * Creates a new service unavailable exception.
   *
   * @param t
   *          the exception causing the error
   */
  public ServiceUnavailableException(Throwable t) {
    super(t);
  }

}
