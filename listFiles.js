const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');

const desktopPath = path.join(require('os').homedir(), 'Desktop', 'PSNRecords');

if (!fs.existsSync(desktopPath)) {
  fs.mkdirSync(desktopPath, { recursive: true });
}

const directoryUrl = 'http://native-ps3.np.ac.playstation.net'; // Replace with your URL

async function fetchDirectoryListing(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    
    const $ = cheerio.load(html);
    
    const fileLinks = [];
    $('a').each((index, element) => {
      const href = $(element).attr('href');
      if (href && !href.startsWith('http') && !href.startsWith('javascript:void(0)') && href !== '/') {
        const fullUrl = new URL(href, url).href;
        fileLinks.push(fullUrl);
      }
    });
    
    console.log('Files to download:');
    fileLinks.forEach(link => console.log(link));

    for (const fileUrl of fileLinks) {
      await downloadFile(fileUrl);
    }
    
  } catch (error) {
    console.error('Error fetching directory listing:', error);
  }
}

async function downloadFile(fileUrl) {
  try {
    const urlObj = new URL(fileUrl);
    let fileName = path.basename(urlObj.pathname);

    const headResponse = await axios({
      url: fileUrl,
      method: 'HEAD',
    });
    
    if (headResponse.status !== 200) {
      console.error(`HEAD request failed for ${fileUrl} with status code ${headResponse.status}`);
      return;
    }

    const contentType = headResponse.headers['content-type'];
    let fileExtension = '';

    if (contentType.includes('html') || contentType.includes('xhtml')) {
      fileExtension = '.html';
    } else if (contentType.includes('xml')) {
      fileExtension = '.xml';
    } else if (contentType.includes('javascript') || contentType.includes('js')) {
      fileExtension = '.js';
    } else if (contentType.includes('image')) {
      const ext = contentType.split('/')[1];
      fileExtension = `.${ext}`;
    } else {
      fileExtension = path.extname(fileName) || '.txt';
    }

    fileName = fileName.replace(/\.[^/.]+$/, '') + fileExtension;
    const filePath = path.join(desktopPath, fileName);

    console.log(`Downloading ${fileUrl} to ${filePath}`);
    
    const fileResponse = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream',
    });

    if (fileResponse.status !== 200) {
      console.error(`GET request failed for ${fileUrl} with status code ${fileResponse.status}`);
      return;
    }

    const writer = createWriteStream(filePath);
    fileResponse.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

  } catch (error) {
    console.error(`Error downloading file ${fileUrl}:`, error);
  }
}

fetchDirectoryListing(directoryUrl);
