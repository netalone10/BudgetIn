"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorModalProps {
  onClose: () => void;
}

type Operator = "+" | "-" | "×" | "÷";

const keys: Array<{ label: string | Operator; className?: string }> = [
  { label: "C" },
  { label: "⌫" },
  { label: "÷" },
  { label: "×" },
  { label: "7" },
  { label: "8" },
  { label: "9" },
  { label: "-" },
  { label: "4" },
  { label: "5" },
  { label: "6" },
  { label: "+" },
  { label: "1" },
  { label: "2" },
  { label: "3" },
  { label: "=" },
  { label: "0", className: "col-span-2" },
  { label: "." },
];

function calculate(firstValue: number, secondValue: number, operator: Operator) {
  if (operator === "+") return firstValue + secondValue;
  if (operator === "-") return firstValue - secondValue;
  if (operator === "×") return firstValue * secondValue;
  if (secondValue === 0) return null;
  return firstValue / secondValue;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "Error";
  const normalized = Number.parseFloat(value.toPrecision(12));
  return normalized.toString();
}

export default function CalculatorModal({ onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  function resetCalculator() {
    setDisplay("0");
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  }

  function inputDigit(digit: string) {
    if (display === "Error" || waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }

    setDisplay((current) => {
      if (current === "0") return digit;
      if (current.length >= 14) return current;
      return `${current}${digit}`;
    });
  }

  function inputDecimal() {
    if (display === "Error" || waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }

    setDisplay((current) => (current.includes(".") ? current : `${current}.`));
  }

  function deleteDigit() {
    if (display === "Error" || waitingForOperand) {
      setDisplay("0");
      setWaitingForOperand(false);
      return;
    }

    setDisplay((current) => (current.length <= 1 ? "0" : current.slice(0, -1)));
  }

  function chooseOperator(nextOperator: Operator) {
    if (display === "Error") return;

    const inputValue = Number(display);

    if (storedValue === null) {
      setStoredValue(inputValue);
    } else if (operator) {
      const result = calculate(storedValue, inputValue, operator);

      if (result === null) {
        setDisplay("Error");
        setStoredValue(null);
        setOperator(null);
        setWaitingForOperand(true);
        return;
      }

      setDisplay(formatNumber(result));
      setStoredValue(result);
    }

    setOperator(nextOperator);
    setWaitingForOperand(true);
  }

  function showResult() {
    if (display === "Error" || storedValue === null || operator === null) return;

    const result = calculate(storedValue, Number(display), operator);

    if (result === null) {
      setDisplay("Error");
    } else {
      setDisplay(formatNumber(result));
    }

    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  }

  function handleKeyPress(key: string | Operator) {
    if (/^\d$/.test(key)) {
      inputDigit(key);
      return;
    }

    if (key === ".") {
      inputDecimal();
      return;
    }

    if (key === "C") {
      resetCalculator();
      return;
    }

    if (key === "⌫") {
      deleteDigit();
      return;
    }

    if (key === "=") {
      showResult();
      return;
    }

    chooseOperator(key as Operator);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="calculator-title">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="calculator-title" className="text-base font-semibold">Calculator</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Tutup calculator"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border bg-background px-4 py-3 text-right">
          <div className="min-h-8 break-all text-2xl font-semibold tracking-tight text-foreground">
            {display}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {keys.map(({ label, className }) => {
            const key = label;
            const isOperator = ["+", "-", "×", "÷", "="].includes(key);
            const isAction = key === "C" || key === "⌫";

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleKeyPress(key)}
                className={cn(
                  "h-12 rounded-xl border text-sm font-semibold transition-colors active:scale-[0.98]",
                  isOperator
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : isAction
                      ? "border-border bg-muted text-foreground hover:bg-muted/80"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  className
                )}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
