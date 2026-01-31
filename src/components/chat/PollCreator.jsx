import { useState } from 'react';
import { MdClose, MdAdd, MdPoll, MdCheck } from 'react-icons/md';
import { Button } from '../shared/Button';

export const PollCreator = ({ onSubmit, onClose }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [anonymous, setAnonymous] = useState(false);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    const validOptions = options.filter(opt => opt.trim() !== '');
    if (question.trim() && validOptions.length >= 2) {
      onSubmit({
        question: question.trim(),
        options: validOptions,
        multipleChoice,
        anonymous
      });
      onClose();
    }
  };

  const isValid = question.trim() && options.filter(opt => opt.trim()).length >= 2;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-sidebar rounded-lg w-full max-w-md mx-4 shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-hover">
          <div className="flex items-center gap-2">
            <MdPoll className="text-brand-primary" size={24} />
            <h2 className="text-lg font-semibold text-dark-text">Create Poll</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-dark-hover rounded transition-colors"
          >
            <MdClose className="text-dark-muted" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Question */}
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-2">
              Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              maxLength={300}
              className="w-full bg-dark-input text-dark-text px-4 py-3 rounded-lg
                         border border-transparent focus:border-brand-primary
                         outline-none transition-colors"
              autoFocus
            />
            <div className="text-xs text-dark-muted mt-1 text-right">
              {question.length}/300
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-2">
              Options
            </label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-dark-muted text-sm w-6">{index + 1}.</span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    maxLength={100}
                    className="flex-1 bg-dark-input text-dark-text px-3 py-2 rounded
                               border border-transparent focus:border-brand-primary
                               outline-none transition-colors text-sm"
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(index)}
                      className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                    >
                      <MdClose size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {options.length < 10 && (
              <button
                onClick={addOption}
                className="mt-2 flex items-center gap-1 text-sm text-brand-primary hover:text-brand-primary/80 transition-colors"
              >
                <MdAdd size={18} />
                Add Option
              </button>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-3 pt-2 border-t border-dark-hover">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                multipleChoice ? 'bg-brand-primary border-brand-primary' : 'border-dark-muted group-hover:border-dark-text'
              }`}>
                {multipleChoice && <MdCheck size={14} className="text-white" />}
              </div>
              <span className="text-dark-text text-sm">Allow multiple selections</span>
              <input
                type="checkbox"
                checked={multipleChoice}
                onChange={(e) => setMultipleChoice(e.target.checked)}
                className="sr-only"
              />
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                anonymous ? 'bg-brand-primary border-brand-primary' : 'border-dark-muted group-hover:border-dark-text'
              }`}>
                {anonymous && <MdCheck size={14} className="text-white" />}
              </div>
              <span className="text-dark-text text-sm">Anonymous voting</span>
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-dark-hover">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValid}
          >
            Create Poll
          </Button>
        </div>
      </div>
    </div>
  );
};
