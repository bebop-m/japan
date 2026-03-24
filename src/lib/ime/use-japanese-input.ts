"use client";

import { useState } from "react";

export interface JapaneseInputBinding {
  value: string;
  committedValue: string;
  isComposing: boolean;
  setValue: (value: string) => void;
  reset: () => void;
  bind: {
    value: string;
    onCompositionStart: () => void;
    onCompositionEnd: (event: React.CompositionEvent<HTMLTextAreaElement>) => void;
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  };
}

export function useJapaneseInput(initialValue = ""): JapaneseInputBinding {
  const [value, setValue] = useState(initialValue);
  const [committedValue, setCommittedValue] = useState(initialValue);
  const [isComposing, setIsComposing] = useState(false);

  return {
    value,
    committedValue,
    isComposing,
    setValue(nextValue: string) {
      setValue(nextValue);
      setCommittedValue(nextValue);
    },
    reset() {
      setValue("");
      setCommittedValue("");
      setIsComposing(false);
    },
    bind: {
      value,
      onCompositionStart() {
        setIsComposing(true);
      },
      onCompositionEnd(event) {
        const nextValue = event.currentTarget.value;
        setIsComposing(false);
        setValue(nextValue);
        setCommittedValue(nextValue);
      },
      onChange(event) {
        const nextValue = event.currentTarget.value;
        setValue(nextValue);

        if (!isComposing) {
          setCommittedValue(nextValue);
        }
      }
    }
  };
}
