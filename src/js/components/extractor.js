import React from 'react';
import Usage from './usage';
import Footer from './footer';
import AdvancedUsage from './advanced-usage';
import prettyPrintHtml from '../tools/pretty-print-html';

var ga = require('../analytics'),
    packageJson = require('../../../package.json'),
    makeSnapshot = require('../tools/make-snapshot'),
    convertToReact = require('../tools/convert-to-react');

const bugUrl = packageJson.bugs.url + '/new';
const errorTitle = encodeURIComponent('Error after extracting');

/**
 * @param name String name to send to GA
 * @param button A DOMNode to add a click listener to
 * @param loadingText [Optional] A string to insert inside the HTML
 * @param buildPostData A function to construct POST data for submitting a
 * form
 */
function linkTrigger(inspected, name, loadingText, buildPostData) {

  var startTime,
      processingTime,
      errorBody;

  // loadingText is optional
  if (typeof loadingText === 'function' && typeof buildPostData === 'undefined') {
    buildPostData = loadingText;
    loadingText = '';
  }

  ga(
    'send',
    'event',
    'link',
    'click',
    name,
    {
      'nonInteraction': true // Don't count against bounce rate
    }
  );

  var {html: originalHtml, css: originalCss, url: originalUrl} = inspected;

  startTime = performance.now();

  inspected = convertToReact(inspected, loadingText);

  processingTime = Math.round(performance.now() - startTime);

  ga(
    'send',
    'timing',
    {
      'timingCategory': 'processing',
      'timingVar': 'convert-to-react-complete',
      'timingValue': processingTime,
      'timingLabel': 'Convert To React Complete'
    }
  );

  errorBody = encodeURIComponent(buildErrorReport(originalHtml, originalCss, originalUrl));

  inspected.html = inspected.html + '\n\n' + generateBugButton(bugUrl + '?title=' + errorTitle + '&body=' + errorBody);

  chrome.runtime.sendMessage({
    post: buildPostData(inspected)
  });

}

// Progressively build the error report, keeping it under the `maxLength`
function buildErrorReport(html, css, url, maxLength = 2000) {

  var htmlOut,
      cssOut,
      error;

  error = `**Error**:

\`\`\`
<TODO: Fill in your error>
\`\`\`

**Version**: v${packageJson.version}

**URL**: ${url}`;

  htmlOut = `

**Extracting**:

\`\`\`html
${html}
\`\`\``;

  if (error.length + htmlOut.length > maxLength) {
    return error;
  } else {
    error = error + htmlOut;
  }

  cssOut = `
\`\`\`css
${css}
\`\`\``;

  if (error.length + cssOut.length > maxLength) {
    return error;
  } else {
    error = error + cssOut
  }

  return error;
}

function generateBugButton(url) {
  // TODO: global regex to replace ' with \' in the url string
  return '<button type="button" onclick="window.open(\'' + url.replace(/'/g, "\\'") + '\', \'_blank\')" style="position:absolute; right: 20px; bottom: 20px;">Not working?</button>';
}


let Extractor = React.createClass({

  propTypes: {
    inspected: React.PropTypes.shape({
      url: React.PropTypes.string,
      html: React.PropTypes.string,
      css: React.PropTypes.string
    }).isRequired,
    isLoading: React.PropTypes.bool
  },

  prepareForRender(html) {
    // TODO: html-entities the html, then return an array of elements to render
    return prettyPrintHtml(html).join('<br />');
  },

  getInitialState() {
    return {
      hasInspected: !!this.props.inspected.html,
      prettyInspected: this.prepareForRender(this.props.inspected.html)
    }
  },

  componentWillReceiveProps(newProps) {
    if (
      newProps.inspected.url !== this.props.inspected.url
      || newProps.inspected.html !== this.props.inspected.html
      || newProps.inspected.css !== this.props.inspected.css
    ) {
      this.setState({
        hasInspected: !!newProps.inspected.html,
        prettyInspected: this.prepareForRender(newProps.inspected.html)
      });
    }
  },

  handleCodepen(event) {
    event.stopPropagation();
    event.preventDefault();

    linkTrigger(this.props.inspected, 'codepen', function(output) {

      return {
        url: 'http://codepen.io/pen/define',
        data: {
          "data": JSON.stringify({
            html: output.html,
            css: output.css,
            js: output.js,
            js_external: 'https://cdnjs.cloudflare.com/ajax/libs/react/0.14.6/react.min.js;https://cdnjs.cloudflare.com/ajax/libs/react/0.14.6/react-dom.min.js',
            js_pre_processor: 'babel'
          })
        }
      }
    });

  },

  render() {

    let inspectedContent = this.state.prettyInspected,
        buttonProps = {};

    if (!this.state.hasInspected) {
      buttonProps.disabled = true;
      if (this.props.isLoading) {
        inspectedContent = <i>Loading...</i>;
      } else {
        inspectedContent = <i>none</i>;
      }
    }

    return (
      <div>
        <p>Inspected Element:</p>
        <pre>
          <code>
            {inspectedContent}
          </code>
        </pre>
        <p>Generate and upload to...</p>
        <button {...buttonProps} onClick={this.handleCodepen}>Codepen</button>
      </div>
    );
  }
});

export default Extractor;