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

package org.opencastproject.rest;

import static org.opencastproject.util.data.Collections.toArray;
import static org.opencastproject.util.data.Monadics.mlist;
import static org.opencastproject.util.data.Option.some;
import static org.opencastproject.util.data.functions.Misc.chuck;

import org.opencastproject.util.UrlSupport;
import org.opencastproject.util.data.Function;
import org.opencastproject.util.data.Option;

import com.sun.jersey.api.core.ClassNamesResourceConfig;
import com.sun.jersey.api.core.PackagesResourceConfig;
import com.sun.jersey.api.core.ResourceConfig;
import com.sun.jersey.spi.container.servlet.ServletContainer;

import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.hamcrest.BaseMatcher;
import org.hamcrest.Description;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URL;
import java.net.URLConnection;
import java.util.Random;
import java.util.regex.Pattern;

/**
 * Helper environment for creating REST service unit tests.
 * <p>
 * The REST endpoint to test needs a no-arg constructor in order to be created by the framework.
 * <p>
 * Write REST unit tests using <a href="http://code.google.com/p/rest-assured/">rest assured</a>.
 * <h3>Example Usage</h3>
 * 
 * <pre>
 *   import static com.jayway.restassured.RestAssured.*;
 *   import static com.jayway.restassured.matcher.RestAssuredMatchers.*;
 *   import static org.hamcrest.Matchers.*;
 *   import static org.opencastproject.rest.RestServiceTestEnv.*
 *
 *   public class RestEndpointTest {
 *   // create a local environment running on some random port
 *   // use rt.host("/path/to/service") to wrap all URL creations for HTTP request methods
 *   private static final RestServiceTestEnv rt = testEnvScanAllPackages(localhostRandomPort());
 *
 *   \@BeforeClass public static void oneTimeSetUp() {
 *   env.setUpServer();
 *   }
 *
 *   \@AfterClass public static void oneTimeTearDown() {
 *   env.tearDownServer();
 *   }
 *   }
 * </pre>
 * 
 * Add the following dependencies to your pom
 * 
 * <pre>
 * &lt;dependency&gt;
 *   &lt;groupId&gt;com.jayway.restassured&lt;/groupId&gt;
 *   &lt;artifactId&gt;rest-assured&lt;/artifactId&gt;
 *   &lt;version&gt;1.7.2&lt;/version&gt;
 *   &lt;scope&gt;test&lt;/scope&gt;
 * &lt;/dependency&gt;
 * &lt;dependency&gt;
 *   &lt;groupId&gt;org.apache.httpcomponents&lt;/groupId&gt;
 *   &lt;artifactId&gt;httpcore&lt;/artifactId&gt;
 *   &lt;version&gt;4.2.4&lt;/version&gt;
 *   &lt;scope&gt;test&lt;/scope&gt;
 * &lt;/dependency&gt;
 * </pre>
 */
public final class RestServiceTestEnv {
  private Server hs;

  private final URL baseUrl;
  private final Option<? extends ResourceConfig> cfg;

  private static final Logger logger = LoggerFactory.getLogger(RestServiceTestEnv.class);

  /**
   * Create an environment for <code>baseUrl</code>. The base URL should be the URL where the service to test is
   * mounted, e.g. http://localhost:8090/test
   */
  private RestServiceTestEnv(URL baseUrl, Option<? extends ResourceConfig> cfg) {
    this.baseUrl = baseUrl;
    this.cfg = cfg;
  }

  public static RestServiceTestEnv testEnvScanAllPackages(URL baseUrl) {
    return new RestServiceTestEnv(baseUrl, Option.<ResourceConfig> none());
  }

  public static RestServiceTestEnv testEnvScanPackages(URL baseUrl, Package... servicePkgs) {
    return new RestServiceTestEnv(baseUrl,
            some(new PackagesResourceConfig(toArray(String.class, mlist(servicePkgs).map(pkgName).value()))));
  }

  public static RestServiceTestEnv testEnvForClasses(URL baseUrl, Class... restServices) {
    return new RestServiceTestEnv(baseUrl, some(new ClassNamesResourceConfig(restServices)));
  }

  public static RestServiceTestEnv testEnvForCustomConfig(String baseUrl, ResourceConfig cfg) {
    return new RestServiceTestEnv(UrlSupport.url(baseUrl), some(cfg));
  }

  public static RestServiceTestEnv testEnvForCustomConfig(URL baseUrl, ResourceConfig cfg) {
    return new RestServiceTestEnv(baseUrl, some(cfg));
  }

  /**
   * Return a localhost base URL with a random port between 8081 and 9000. The method features a port usage detection to
   * ensure it returns a free port.
   */
  public static URL localhostRandomPort() {
    for (int tries = 100; tries > 0; tries--) {
      final URL url = UrlSupport.url("http", "localhost", 8081 + new Random(System.currentTimeMillis()).nextInt(919));
      try {
        final URLConnection con = url.openConnection();
        con.setConnectTimeout(1000);
        con.setReadTimeout(1000);
        con.getInputStream();
      } catch (IOException e) {
        return url;
      }
    }
    throw new RuntimeException("Cannot find free port. Giving up.");
  }

  /** Create a URL suitable for rest-assured's post(), get() e.al. methods. */
  public String host(String path) {
    return UrlSupport.url(baseUrl, path).toString();
  }

  /** Return the port the configured server is running on. */
  public int getPort() {
    return baseUrl.getPort();
  }

  /**
   * Return the base URL of the HTTP server. <code>http://host:port</code> public URL getBaseUrl() { return baseUrl; }
   *
   * Call in @BeforeClass annotated method.
   */
  public void setUpServer() {
    try {
      // cut of any base pathbasestUrl might have
      int port = baseUrl.getPort();
      logger.info("Start http server at port " + port);
      hs = new Server(port);
      ServletContainer servletContainer = cfg.isSome() ? new ServletContainer(cfg.get()) : new ServletContainer();
      ServletHolder jerseyServlet = new ServletHolder(servletContainer);
      ServletContextHandler context = new ServletContextHandler(hs, "/");
      context.addServlet(jerseyServlet, "/*");
      hs.start();
    } catch (Exception e) {
      chuck(e);
    }
  }

  /** Call in @AfterClass annotated method. */
  public void tearDownServer() {
    if (hs != null) {
      logger.info("Stop http server");
      try {
        hs.stop();
      } catch (Exception e) {
        logger.warn("Stop http server - failed {}", e.getMessage());
      }
    }
  }

  private static final Function<Package, String> pkgName = new Function<Package, String>() {
    @Override
    public String apply(Package pkg) {
      return pkg.getName();
    }
  };

  // Hamcrest matcher

  public static class RegexMatcher extends BaseMatcher<String> {
    private final Pattern p;

    public RegexMatcher(String pattern) {
      p = Pattern.compile(pattern);
    }

    public static RegexMatcher regex(String pattern) {
      return new RegexMatcher(pattern);
    }

    @Override
    public boolean matches(Object item) {
      return item != null && p.matcher(item.toString()).matches();
    }

    @Override
    public void describeTo(Description description) {
      description.appendText("regex [" + p.pattern() + "]");
    }
  }
}
