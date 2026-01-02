import { QuoteBlock } from '../components/QuoteBlock';
import { Banner } from '../components/Banner';

interface ScreenPageProps {
  screenNumber: number;
}

export function ScreenPage({ screenNumber }: ScreenPageProps) {
  const regressionCase = import.meta.env.VITE_REGRESSION_CASE || '';
  const screenId = String(screenNumber).padStart(2, '0');

  const isScreen03 = screenNumber === 3;
  const isScreen07 = screenNumber === 7;
  const isScreen10 = screenNumber === 10;

  const hasButtonPaddingRegression = isScreen03 && regressionCase === 'button-padding';
  const hasMissingBannerRegression = isScreen07 && regressionCase === 'missing-banner';
  const hasFontSizeRegression = isScreen10 && regressionCase === 'font-size';

  const buttonPadding = hasButtonPaddingRegression ? 'px-8 py-6' : 'px-4 py-2';
  const headingSize = hasFontSizeRegression ? 'text-5xl' : 'text-3xl';

  const showQuote = [2, 5, 8, 11, 14, 17, 20].includes(screenNumber);
  const showBanner = [1, 4, 7, 10, 13, 16, 19].includes(screenNumber);

  return (
    <div data-testid={`screen-${screenId}`}>
      {showBanner && !hasMissingBannerRegression && <Banner />}

      <h1 className={`${headingSize} font-bold text-gray-900 mb-6`} data-testid="heading">
        Screen {screenId}
      </h1>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Content Section</h2>
          <p className="text-gray-600 mb-4">
            This is screen {screenId} of the AI Output Gate demo application. Each screen has
            consistent layout and predictable UI elements to facilitate visual regression testing.
          </p>
          
          <div className="flex gap-3" data-testid="button-group">
            <button
              className={`${buttonPadding} bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors`}
              data-testid="primary-button"
            >
              Primary Action
            </button>
            <button
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              data-testid="secondary-button"
            >
              Secondary Action
            </button>
          </div>
        </div>

        {showQuote && <QuoteBlock />}

        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
              data-testid={`card-${i}`}
            >
              <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded mb-3"></div>
              <h3 className="font-semibold text-gray-800 mb-2">Card {i}</h3>
              <p className="text-sm text-gray-600">
                Sample content for card {i} on screen {screenId}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Statistics</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: '1,234' },
              { label: 'Active Sessions', value: '56' },
              { label: 'Conversion Rate', value: '3.2%' },
              { label: 'Revenue', value: '$12,345' },
            ].map((stat, i) => (
              <div key={i} data-testid={`stat-${i}`}>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
