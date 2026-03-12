import { FeedbackApp } from './components/FeedbackApp';
import { PlaybackDataProvider } from './context/PlaybackDataContext';

function App() {
  return (
    <PlaybackDataProvider useMock={false} jsonUrl="/data/frontend.json">
      <FeedbackApp />
    </PlaybackDataProvider>
  );
}

export default App;
